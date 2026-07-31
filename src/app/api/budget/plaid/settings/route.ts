import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'plaid_config'").get() as { value: string } | undefined
  let config = { client_id: '', secret: '', environment: 'sandbox' }
  if (row) {
    try { config = JSON.parse(row.value) } catch { /* ignore */ }
  }
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
    db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('plaid_config', ?)").run(JSON.stringify(cfg))

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
