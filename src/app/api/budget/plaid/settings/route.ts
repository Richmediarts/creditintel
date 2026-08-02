import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import fs from 'fs'
import path from 'path'

async function readPlaidConfig(): Promise<{ client_id: string; secret: string; environment: string }> {
  const empty = { client_id: '', secret: '', environment: 'sandbox' }

  // 1. Check DB
  try {
    const db = getDb()
    await db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
    const row = await db.get("SELECT value FROM settings WHERE key = 'plaid_config'", [])
    if (row) {
      try {
        const cfg = JSON.parse(row.value)
        if (cfg.client_id) return cfg
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
          if (cfg.client_id) {
            // Hydrate DB
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

  // 3. Env vars
  return {
    client_id: process.env.PLAID_CLIENT_ID || '',
    secret: process.env.PLAID_SECRET || '',
    environment: process.env.PLAID_ENV || 'sandbox',
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await readPlaidConfig()
  return NextResponse.json({ client_id: config.client_id, environment: config.environment })
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const cfg = {
      client_id: (body.client_id || '').trim(),
      secret: (body.secret || '').trim(),
      environment: (body.environment || 'sandbox').trim(),
    }

    const db = getDb()
    await db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
    await db.run("INSERT INTO settings (key, value) VALUES ('plaid_config', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [JSON.stringify(cfg)])

    // Persist to seed.json so settings survive Vercel cold starts
    try {
      const seedPath = path.join(process.cwd(), 'seed', 'seed.json')
      if (fs.existsSync(seedPath)) {
        const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
        seed.settings = seed.settings || []
        const existing = seed.settings.findIndex((s: { key: string }) => s.key === 'plaid_config')
        const entry = { key: 'plaid_config', value: JSON.stringify(cfg) }
        if (existing >= 0) {
          seed.settings[existing] = entry
        } else {
          seed.settings.push(entry)
        }
        fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2))
      }
    } catch { /* best-effort */ }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
