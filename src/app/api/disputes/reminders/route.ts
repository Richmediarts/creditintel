import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

interface DisputeRow {
  id: number
  creditor_name: string
  bureau: string
  expected_response_date: string
  status: string
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
  const now = new Date().toISOString().split('T')[0]

  const overdue = (await db.all(`
    SELECT * FROM disputes
    WHERE user_id = ? AND status NOT IN ('complete') AND expected_response_date IS NOT NULL AND expected_response_date < ?
    ORDER BY expected_response_date ASC
  `, [auth.userId, now])) as DisputeRow[]

  const dueSoon = (await db.all(`
    SELECT * FROM disputes
    WHERE user_id = ? AND status NOT IN ('complete')
      AND expected_response_date IS NOT NULL AND expected_response_date >= ? AND expected_response_date <= (?::date + INTERVAL '7 days')
    ORDER BY expected_response_date ASC
  `, [auth.userId, now, now])) as DisputeRow[]

  return NextResponse.json({
    overdue: overdue.map(d => ({
      id: d.id,
      creditorName: d.creditor_name,
      bureau: d.bureau,
      expectedResponseDate: d.expected_response_date,
      status: d.status,
    })),
    dueSoon: dueSoon.map(d => ({
      id: d.id,
      creditorName: d.creditor_name,
      bureau: d.bureau,
      expectedResponseDate: d.expected_response_date,
      status: d.status,
      daysUntil: Math.ceil((new Date(d.expected_response_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    })),
  })
}