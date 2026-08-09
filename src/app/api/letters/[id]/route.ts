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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDb()
  const letter = (await db.get(
    'SELECT * FROM dispute_letters WHERE id = ? AND user_id = ?',
    [Number(id), auth.userId]
  )) as LetterRow | null

  if (!letter) {
    return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
  }

  return NextResponse.json({
    letter: {
      id: letter.id,
      creditorName: letter.creditor_name,
      bureau: letter.bureau,
      letterType: letter.letter_type,
      letterText: letter.letter_text,
      createdAt: letter.created_at,
    },
  })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDb()
  const result = await db.run('DELETE FROM dispute_letters WHERE id = ? AND user_id = ?', [Number(id), auth.userId])
  if (result.changes === 0) {
    return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
