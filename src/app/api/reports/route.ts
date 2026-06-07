import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function GET(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDb()
  const rows = db.prepare('SELECT bureau, data FROM reports WHERE user_id = ?').all(auth.userId) as any[]

  const reports = rows.map(r => {
    try {
      return JSON.parse(r.data)
    } catch {
      return null
    }
  }).filter(Boolean)

  return NextResponse.json({ reports })
}

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { bureau, data } = await request.json()
    if (!bureau || !data) {
      return NextResponse.json({ error: 'Bureau and data required' }, { status: 400 })
    }

    const db = getDb()
    db.prepare(`
      INSERT INTO reports (user_id, bureau, data, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, bureau) DO UPDATE SET data = excluded.data, updated_at = datetime('now')
    `).run(auth.userId, bureau, JSON.stringify(data))

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to save report' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const bureau = request.nextUrl.searchParams.get('bureau')
  if (!bureau) {
    return NextResponse.json({ error: 'Bureau parameter required' }, { status: 400 })
  }

  const db = getDb()
  db.prepare('DELETE FROM reports WHERE user_id = ? AND bureau = ?').run(auth.userId, bureau)

  return NextResponse.json({ success: true })
}
