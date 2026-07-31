import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { Configuration, PlaidApi, PlaidEnvironments, ItemPublicTokenExchangeRequest, AccountsGetRequest, TransactionsSyncRequest } from 'plaid'
import { addPlaidItem, addBankAccount, addCreditCard, addBill, addPayee, getPayeeByName, getAccountsByPlaidItem, upsertPlaidTransaction, updatePlaidCursor, deletePlaidTransaction } from '@/lib/budget-db'

function getPlaidConfig() {
  const db = getDb()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'plaid_config'").get() as { value: string } | undefined
  if (row) {
    try { return JSON.parse(row.value) } catch { /* ignore */ }
  }
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

  const config = getPlaidConfig()
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

    const itemPk = addPlaidItem(user.userId, accessToken, itemId, institutionName)

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
        addBankAccount(user.userId, {
          name,
          account_type: acctSubtype || (acctType === 'investment' ? 'investment' : 'checking'),
          institution: institutionName,
          account_number_last4: mask,
          current_balance: balance,
          website: '',
          plaid_account_id: plaidAccountId,
          plaid_item_id: itemPk,
        })
        created.push({ type: 'bank', name })
      } else if (acctType === 'credit') {
        const cardId = addCreditCard(user.userId, {
          name,
          last_four: mask,
          credit_limit: limitVal,
          current_balance: balance,
          interest_rate: 0,
          due_date: '',
          plaid_account_id: plaidAccountId,
          plaid_item_id: itemPk,
        })
        if (name) {
          const existingPayee = getPayeeByName(user.userId, name)
          const payeeId = existingPayee ? existingPayee.id : addPayee(user.userId, { name })
          addBill(user.userId, {
            payee_id: payeeId,
            payee_name: name,
            amount: balance,
            due_date: '',
            is_paid: 0,
            is_recurring: 1,
            recurrence_type: 'monthly',
            notes: `Credit Card Payment - ${name}`,
            credit_card_id: cardId,
            account: name,
          })
        }
        created.push({ type: 'credit', name })
      } else if (acctType === 'loan') {
        addBankAccount(user.userId, {
          name,
          account_type: 'loan',
          institution: institutionName,
          account_number_last4: mask,
          current_balance: balance,
          website: '',
          plaid_account_id: plaidAccountId,
          plaid_item_id: itemPk,
        })
        created.push({ type: 'bank', name })
      }
    }

    try {
      let cursorVal = ''
      let hasMore = true
      while (hasMore) {
        const syncReq: TransactionsSyncRequest = { access_token: accessToken, cursor: cursorVal }
        const syncRes = await client.transactionsSync(syncReq)
        const syncData = syncRes.data

        const accountsMap = new Map(getAccountsByPlaidItem(user.userId, itemPk).map(a => [a.plaid_account_id, a]))

        for (const tx of syncData.added) {
          const local = accountsMap.get(tx.account_id)
          if (!local) continue
          upsertPlaidTransaction(user.userId, local.id, tx.transaction_id, tx.date, tx.merchant_name || tx.name || '', -(tx.amount || 0), 0)
        }
        for (const tx of syncData.modified) {
          const local = accountsMap.get(tx.account_id)
          if (!local) continue
          upsertPlaidTransaction(user.userId, local.id, tx.transaction_id, tx.date, tx.merchant_name || tx.name || '', -(tx.amount || 0), 0)
        }
        for (const tx of syncData.removed) {
          deletePlaidTransaction(tx.transaction_id)
        }

        cursorVal = syncData.next_cursor
        hasMore = syncData.has_more
      }
      if (cursorVal) updatePlaidCursor(user.userId, itemPk, cursorVal)
    } catch {
      // Initial sync failure is non-fatal
    }

    return NextResponse.json({ success: true, accounts: created })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
