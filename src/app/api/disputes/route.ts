import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb, calculateExpectedResponseDateFrom } from '@/lib/db'
import { routeDispute } from '@/lib/utils/disputeRouting'
import type { Bureau, LetterType } from '@/types'

interface DisputeRow {
  id: number
  user_id: number
  creditor_name: string
  bureau: string
  inaccuracies: string | null
  status: string
  letter_type: string
  method?: string
  requires_mail?: number
  confirmation_number?: string | null
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

    const parsedInaccuracies: string[] = d.inaccuracies ? JSON.parse(d.inaccuracies) : []
    const routing = routeDispute(
      d.bureau as Bureau,
      parsedInaccuracies,
      (d.letter_type || 'validation') as LetterType
    )

    return {
      id: d.id,
      userId: d.user_id,
      creditorName: d.creditor_name,
      bureau: d.bureau,
      inaccuracies: parsedInaccuracies,
      letterType: d.letter_type || 'validation',
      status: d.status,
      method: (d.method as 'online' | 'mail') || routing.method,
      requiresMail: d.requires_mail ? true : routing.requiresMail,
      routing,
      confirmationNumber: d.confirmation_number || null,
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
    const { creditorName, bureau, inaccuracies, filedDate, notes, status, letterType, method } = await request.json()

    if (!creditorName || !bureau) {
      return NextResponse.json({ error: 'Creditor name and bureau required' }, { status: 400 })
    }

    const db = getDb()
    const now = new Date().toISOString().split('T')[0]
    const lt = letterType || 'validation'
    const effectiveFiledDate = filedDate || now
    const expectedDate = calculateExpectedResponseDateFrom(lt, effectiveFiledDate)

    // Determine the filing channel. An explicit `method` from the client wins,
    // otherwise fall back to the routing engine's verdict.
    const routing = routeDispute(bureau as Bureau, inaccuracies || [], lt as LetterType)
    const finalMethod = method === 'mail' || method === 'online' ? method : routing.method
    const requiresMail = finalMethod === 'mail' ? 1 : 0

    // Online disputes are filed the moment they are created; mail disputes are
    // only "filed" once the letter is actually sent.
    const initialStatus = finalMethod === 'online' ? 'sent' : (status || 'printed')

    const result = await db.run(`
      INSERT INTO disputes (user_id, creditor_name, bureau, inaccuracies, status, letter_type, method, requires_mail, filed_date, expected_response_date, notes, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [
      auth.userId,
      creditorName.trim(),
      bureau,
      JSON.stringify(inaccuracies || []),
      initialStatus,
      lt,
      finalMethod,
      requiresMail,
      effectiveFiledDate,
      expectedDate,
      notes || '',
      finalMethod === 'online' ? now : null,
    ])

    return NextResponse.json({ id: result.lastInsertRowid, method: finalMethod, routing }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to create dispute' }, { status: 500 })
  }
}
