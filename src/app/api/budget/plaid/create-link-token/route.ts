import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { Configuration, PlaidApi, PlaidEnvironments, LinkTokenCreateRequest, LinkTokenCreateRequestUser, CountryCode, Products } from 'plaid'
import fs from 'fs'
import path from 'path'

function getPlaidConfig() {
  // 1. Check DB settings table
  try {
    const db = getDb()
    db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
    const row = db.prepare("SELECT value FROM settings WHERE key = 'plaid_config'").get() as { value: string } | undefined
    if (row) {
      try {
        const cfg = JSON.parse(row.value)
        if (cfg.client_id && cfg.secret) return cfg
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  // 2. Check seed.json directly (survives Vercel cold starts)
  try {
    const seedPath = path.join(process.cwd(), 'seed', 'seed.json')
    if (fs.existsSync(seedPath)) {
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
      if (seed.settings) {
        const entry = seed.settings.find((s: { key: string }) => s.key === 'plaid_config')
        if (entry) {
          const cfg = JSON.parse(entry.value)
          if (cfg.client_id && cfg.secret) {
            // Also hydrate DB for this instance
            try {
              const db = getDb()
              db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
              db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('plaid_config', ?)").run(entry.value)
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
