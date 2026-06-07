import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb, calculateExpectedResponseDate } from '@/lib/db'

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
  const disputes = db.prepare(
    'SELECT * FROM disputes WHERE user_id = ? ORDER BY updated_at DESC'
  ).all(auth.userId) as any[]

  const now = new Date()
  const result = disputes.map(d => {
    let isOverdue = false
    let daysUntilResponse: number | null = null

    if (d.expected_response_date) {
      const expected = new Date(d.expected_response_date)
      daysUntilResponse = Math.ceil((expected.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      isOverdue = daysUntilResponse < 0 && d.status !== 'resolved' && d.status !== 'closed'
    }

    return {
      id: d.id,
      userId: d.user_id,
      creditorName: d.creditor_name,
      bureau: d.bureau,
      inaccuracies: d.inaccuracies ? JSON.parse(d.inaccuracies) : [],
      status: d.status,
      filedDate: d.filed_date,
      expectedResponseDate: d.expected_response_date,
      resolvedDate: d.resolved_date,
      notes: d.notes || '',
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      isOverdue,
      daysUntilResponse,
    }
  })

  return NextResponse.json({ disputes: result })
}

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { creditorName, bureau, inaccuracies, filedDate, notes, status } = await request.json()

    if (!creditorName || !bureau) {
      return NextResponse.json({ error: 'Creditor name and bureau required' }, { status: 400 })
    }

    const db = getDb()
    const now = new Date().toISOString().split('T')[0]
    const effectiveFiledDate = filedDate || now
    const expectedDate = calculateExpectedResponseDate(bureau, effectiveFiledDate)

    const result = db.prepare(`
      INSERT INTO disputes (user_id, creditor_name, bureau, inaccuracies, status, filed_date, expected_response_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auth.userId,
      creditorName.trim(),
      bureau,
      JSON.stringify(inaccuracies || []),
      status || 'filed',
      effectiveFiledDate,
      expectedDate,
      notes || '',
    )

    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to create dispute' }, { status: 500 })
  }
}
