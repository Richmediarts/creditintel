import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

interface LetterRow {
  id: number
  user_id: number
  creditor_name: string
  bureau: string
  letter_type: string
  letter_text: string
  created_at: string
}

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
  const letters = (await db.all(
    'SELECT * FROM dispute_letters WHERE user_id = ? ORDER BY created_at DESC',
    [auth.userId]
  )) as LetterRow[]

  const result = letters.map(l => ({
    id: l.id,
    creditorName: l.creditor_name,
    bureau: l.bureau,
    letterType: l.letter_type,
    createdAt: l.created_at,
  }))

  return NextResponse.json({ letters: result })
}

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { creditorName, bureau, letterType, letterText } = await request.json()

    if (!creditorName || !bureau || !letterType || !letterText) {
      return NextResponse.json({ error: 'Creditor name, bureau, letter type and letter text required' }, { status: 400 })
    }

    const db = getDb()
    const result = await db.run(`
      INSERT INTO dispute_letters (user_id, creditor_name, bureau, letter_type, letter_text)
      VALUES (?, ?, ?, ?, ?)
      RETURNING id
    `, [
      auth.userId,
      creditorName.trim(),
      bureau,
      letterType,
      letterText,
    ])

    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to save letter' }, { status: 500 })
  }
}
