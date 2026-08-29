import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'
import { getDb } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export interface PlaidConfig {
  client_id: string
  secret: string
  environment: string
}

export async function getPlaidConfig(): Promise<PlaidConfig> {
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
            // Hydrate DB for this instance
            try {
              const db = getDb()
              await db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
              await db.run("INSERT INTO settings (key, value) VALUES ('plaid_config', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [entry.value])
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

export function getPlaidClient(config: PlaidConfig) {
  // The bundled `plaid` package only ships production/sandbox URLs, so the
  // development environment is explicit.
  const basePath =
    config.environment === 'production'
      ? PlaidEnvironments.production
      : config.environment === 'development'
        ? 'https://development.plaid.com'
        : PlaidEnvironments.sandbox

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

export function requirePlaidConfig(config: PlaidConfig): boolean {
  return Boolean(config.client_id && config.secret)
}