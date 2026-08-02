import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb, calculateExpectedResponseDateFrom } from '@/lib/db'

interface DisputeRow {
  id: number
  user_id: number
  creditor_name: string
  bureau: string
  inaccuracies: string | null
  status: string
  letter_type: string
  filed_date: string | null
  expected_response_date: string | null
  resolved_date: string | null
  notes: string | null
  printed_at: string | null
  sent_at: string | null
  pending_at: string | null
  resend_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
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
  const disputes = (await db.all(
    'SELECT * FROM disputes WHERE user_id = ? ORDER BY updated_at DESC',
    [auth.userId]
  )) as DisputeRow[]

  const now = new Date()
  const result = disputes.map((d: DisputeRow) => {
    let isOverdue = false
    let daysUntilResponse: number | null = null

    if (d.expected_response_date) {
      const expected = new Date(d.expected_response_date)
      daysUntilResponse = Math.ceil((expected.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      isOverdue = daysUntilResponse < 0 && d.status !== 'complete'
    }

    return {
      id: d.id,
      userId: d.user_id,
      creditorName: d.creditor_name,
      bureau: d.bureau,
      inaccuracies: d.inaccuracies ? JSON.parse(d.inaccuracies) : [],
      letterType: d.letter_type || 'validation',
      status: d.status,
      printedAt: d.printed_at || null,
      sentAt: d.sent_at || null,
      pendingAt: d.pending_at || null,
      resendAt: d.resend_at || null,
      completedAt: d.completed_at || null,
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
    const { creditorName, bureau, inaccuracies, filedDate, notes, status, letterType } = await request.json()

    if (!creditorName || !bureau) {
      return NextResponse.json({ error: 'Creditor name and bureau required' }, { status: 400 })
    }

    const db = getDb()
    const now = new Date().toISOString().split('T')[0]
    const lt = letterType || 'validation'
    const effectiveFiledDate = filedDate || now
    const expectedDate = calculateExpectedResponseDateFrom(lt, effectiveFiledDate)

    const result = await db.run(`
      INSERT INTO disputes (user_id, creditor_name, bureau, inaccuracies, status, letter_type, filed_date, expected_response_date, notes, printed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [
      auth.userId,
      creditorName.trim(),
      bureau,
      JSON.stringify(inaccuracies || []),
      status || 'printed',
      lt,
      effectiveFiledDate,
      expectedDate,
      notes || '',
      now,
    ])

    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to create dispute' }, { status: 500 })
  }
}
