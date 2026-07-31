import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { Configuration, PlaidApi, PlaidEnvironments, LinkTokenCreateRequest, LinkTokenCreateRequestUser, CountryCode, Products } from 'plaid'

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

export async function GET(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = getPlaidConfig()
  if (!config.client_id || !config.secret) {
    return NextResponse.json({ error: 'Plaid not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.' }, { status: 400 })
  }

  try {
    const client = getPlaidClient(config)
    const request2: LinkTokenCreateRequest = {
      client_name: 'Budget Tracker',
      language: 'en',
      country_codes: [CountryCode.Us],
      user: { client_user_id: `user-${user.userId}` },
      products: [Products.Transactions],
    }
    const response = await client.linkTokenCreate(request2)
    return NextResponse.json({ link_token: response.data.link_token })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
