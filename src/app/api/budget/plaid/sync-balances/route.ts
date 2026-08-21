import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { Configuration, PlaidApi, PlaidEnvironments, AccountsBalanceGetRequest } from 'plaid'
import { getPlaidItems } from '@/lib/budget-db'

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

  // 2. Fall back to env vars
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
    const client = getPlaidClient(config)
    const items = await getPlaidItems(user.userId)
    const results: { item: string; status: string; error?: string }[] = []
    const db = getDb()

    for (const item of items) {
      try {
        const req: AccountsBalanceGetRequest = { access_token: item.access_token }
        const res = await client.accountsBalanceGet(req)
        for (const acct of res.data.accounts) {
          const aid = acct.account_id
          const balances = acct.balances || {}
          const balance = acct.type === 'depository'
            ? (balances.available ?? balances.current ?? 0)
            : (balances.current ?? 0)
          const limitVal = balances.limit || 0

          const updated = await db.run('UPDATE budget_bank_accounts SET current_balance = ?, last_synced_at = CURRENT_TIMESTAMP WHERE user_id = ? AND plaid_account_id = ?', [balance, user.userId, aid])
          if (updated.changes === 0) {
            await db.run('UPDATE budget_credit_cards SET current_balance = ?, credit_limit = ?, last_synced_at = CURRENT_TIMESTAMP WHERE user_id = ? AND plaid_account_id = ?', [balance, limitVal, user.userId, aid])
          }
        }
        results.push({ item: item.institution_name || '', status: 'ok' })
      } catch (e: unknown) {
        const plaidCode = (e as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code
        if (plaidCode === 'NO_ACCOUNTS') {
          results.push({ item: item.institution_name || '', status: 'skipped' })
        } else {
          results.push({ item: item.institution_name || '', status: 'error', error: e instanceof Error ? e.message : String(e) })
        }
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
