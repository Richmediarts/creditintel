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
  const rows = db.prepare('SELECT bureau, score, date_updated FROM fico_scores WHERE user_id = ?').all(auth.userId) as any[]

  const scores: Record<string, { score: number | null; dateUpdated: string }> = {}
  for (const r of rows) {
    scores[r.bureau] = { score: r.score, dateUpdated: r.date_updated }
  }

  return NextResponse.json({ scores })
}

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { bureau, score } = await request.json()
    if (!bureau || score === undefined) {
      return NextResponse.json({ error: 'Bureau and score required' }, { status: 400 })
    }
    if (score !== null && (score < 300 || score > 850)) {
      return NextResponse.json({ error: 'Score must be between 300 and 850' }, { status: 400 })
    }

    const db = getDb()
    db.prepare(`
      INSERT INTO fico_scores (user_id, bureau, score, date_updated)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, bureau) DO UPDATE SET score = excluded.score, date_updated = datetime('now')
    `).run(auth.userId, bureau, score)

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to save score' }, { status: 500 })
  }
}
