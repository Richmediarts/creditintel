import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { Configuration, PlaidApi, PlaidEnvironments, AccountsBalanceGetRequest } from 'plaid'
import { getPlaidItems } from '@/lib/budget-db'

function getPlaidConfig() {
  const db = getDb()
  db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
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
    const client = getPlaidClient(config)
    const items = getPlaidItems(user.userId)
    const results: { item: string; status: string; error?: string }[] = []
    const db = getDb()

    for (const item of items) {
      try {
        const req: AccountsBalanceGetRequest = { access_token: item.access_token }
        const res = await client.accountsBalanceGet(req)
        for (const acct of res.data.accounts) {
          const aid = acct.account_id
          const balance = acct.balances?.current || 0
          const limitVal = acct.balances?.limit || 0

          const updated = db.prepare('UPDATE budget_bank_accounts SET current_balance = ? WHERE user_id = ? AND plaid_account_id = ?').run(balance, user.userId, aid)
          if (updated.changes === 0) {
            db.prepare('UPDATE budget_credit_cards SET current_balance = ?, credit_limit = ? WHERE user_id = ? AND plaid_account_id = ?').run(balance, limitVal, user.userId, aid)
          }
        }
        results.push({ item: item.institution_name || '', status: 'ok' })
      } catch (e: unknown) {
        results.push({ item: item.institution_name || '', status: 'error', error: e instanceof Error ? e.message : String(e) })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
