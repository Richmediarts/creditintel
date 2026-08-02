import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { Configuration, PlaidApi, PlaidEnvironments, ItemPublicTokenExchangeRequest, AccountsGetRequest, TransactionsSyncRequest } from 'plaid'
import { addPlaidItem, addBankAccount, addCreditCard, addBill, addPayee, getPayeeByName, getAccountsByPlaidItem, upsertPlaidTransaction, updatePlaidCursor, deletePlaidTransaction } from '@/lib/budget-db'
import fs from 'fs'
import path from 'path'

async function getPlaidConfig() {
  // 1. Check DB settings table
  try {
    const db = getDb()
    await db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
    const row = await db.get("SELECT value FROM settings WHERE key = 'plaid_config'", [])
    if (row) {
      try {
        const cfg = JSON.parse(row.value)
        if (cfg.client_id && cfg.secret) return cfg
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  // 2. Check seed.json directly
  try {
    const seedPath = path.join(process.cwd(), 'seed', 'seed.json')
    if (fs.existsSync(seedPath)) {
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
      if (seed.settings) {
        const entry = seed.settings.find((s: { key: string }) => s.key === 'plaid_config')
        if (entry) {
          const cfg = JSON.parse(entry.value)
          if (cfg.client_id && cfg.secret) {
            // Hydrate DB
            try {
              const db = getDb()
              await db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
              await db.run("INSERT INTO settings (key, value) VALUES ('plaid_config', ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [entry.value])
            } catch { /* ignore */ }
            return cfg
          }
        }
      }
    }
  } catch { /* ignore */ }

  // 3. Fall back to env vars
  return {
    client_id: process.env.PLAID_CLIENT_ID || '',
    secret: process.env.PLAID_SECRET || '',
    environment: process.env.PLAID_ENV || 'sandbox',
  }
}

function getPlaidClient(config: { client_id: string; secret: string; environment: string }) {
  const basePath = config.environment === 'production' ? PlaidEnvironments.production : PlaidEnvironments.sandbox
  const conf = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': config.client_id,
        'PLAID-SECRET': config.secret,
      },
    },
  })
  return new PlaidApi(conf)
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await getPlaidConfig()
  if (!config.client_id || !config.secret) {
    return NextResponse.json({ error: 'Plaid not configured' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const publicToken = body.public_token as string
    const institutionName = body.institution as string || ''

    const client = getPlaidClient(config)

    const exchangeReq: ItemPublicTokenExchangeRequest = { public_token: publicToken }
    const exchangeRes = await client.itemPublicTokenExchange(exchangeReq)
    const accessToken = exchangeRes.data.access_token
    const itemId = exchangeRes.data.item_id

    const accountsReq: AccountsGetRequest = { access_token: accessToken }
    const accountsRes = await client.accountsGet(accountsReq)
    const accountsData = accountsRes.data.accounts

    const itemPk = await addPlaidItem(user.userId, accessToken, itemId, institutionName)

    const created: { type: string; name: string }[] = []

    for (const acct of accountsData) {
      const acctType = acct.type
      const acctSubtype = acct.subtype || ''
      const balance = acct.balances?.current || 0
      const limitVal = acct.balances?.limit || 0
      const mask = acct.mask || ''
      const name = acct.name
      const plaidAccountId = acct.account_id

      if (acctType === 'depository' || acctType === 'investment') {
        await addBankAccount(user.userId, {
          name: institutionName || name,
          account_type: acctSubtype || (acctType === 'investment' ? 'investment' : 'checking'),
          institution: institutionName,
          account_number_last4: mask,
          current_balance: balance,
          website: '',
          plaid_account_id: plaidAccountId,
          plaid_item_id: itemPk,
        })
        created.push({ type: 'bank', name: institutionName || name })
      } else if (acctType === 'credit') {
        const cardId = await addCreditCard(user.userId, {
          name: institutionName || name,
          last_four: mask,
          credit_limit: limitVal,
          current_balance: balance,
          interest_rate: 0,
          due_date: '',
          plaid_account_id: plaidAccountId,
          plaid_item_id: itemPk,
        })
        if (institutionName || name) {
          const payeeName = institutionName || name
          const existingPayee = await getPayeeByName(user.userId, payeeName)
          const payeeId = existingPayee ? existingPayee.id : await addPayee(user.userId, { name: payeeName })
          await addBill(user.userId, {
            payee_id: payeeId,
            payee_name: payeeName,
            amount: balance,
            due_date: '',
            is_paid: 0,
            is_recurring: 1,
            recurrence_type: 'monthly',
            notes: `Credit Card Payment - ${payeeName}`,
            credit_card_id: cardId,
            account: payeeName,
          })
        }
        created.push({ type: 'credit', name: institutionName || name })
      } else if (acctType === 'loan') {
        await addBankAccount(user.userId, {
          name: institutionName || name,
          account_type: 'loan',
          institution: institutionName,
          account_number_last4: mask,
          current_balance: balance,
          website: '',
          plaid_account_id: plaidAccountId,
          plaid_item_id: itemPk,
        })
        created.push({ type: 'bank', name: institutionName || name })
      }
    }

    try {
      let cursorVal = ''
      let hasMore = true
      while (hasMore) {
        const syncReq: TransactionsSyncRequest = { access_token: accessToken, cursor: cursorVal }
        const syncRes = await client.transactionsSync(syncReq)
        const syncData = syncRes.data

        const accountsMap = new Map((await getAccountsByPlaidItem(user.userId, itemPk)).map(a => [a.plaid_account_id, a]))

        for (const tx of syncData.added) {
          const local = accountsMap.get(tx.account_id)
          if (!local) continue
          await upsertPlaidTransaction(user.userId, local.id, tx.transaction_id, tx.date, tx.merchant_name || tx.name || '', -(tx.amount || 0), 0)
        }
        for (const tx of syncData.modified) {
          const local = accountsMap.get(tx.account_id)
          if (!local) continue
          await upsertPlaidTransaction(user.userId, local.id, tx.transaction_id, tx.date, tx.merchant_name || tx.name || '', -(tx.amount || 0), 0)
        }
        for (const tx of syncData.removed) {
          await deletePlaidTransaction(tx.transaction_id)
        }

        cursorVal = syncData.next_cursor
        hasMore = syncData.has_more
      }
      if (cursorVal) await updatePlaidCursor(user.userId, itemPk, cursorVal)
    } catch {
      // Initial sync failure is non-fatal
    }

    return NextResponse.json({ success: true, accounts: created })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
