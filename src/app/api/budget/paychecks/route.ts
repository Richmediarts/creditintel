import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getPaychecks, addPaycheck, getNextPaycheckDate } from '@/lib/budget-db'
import type { BudgetPaycheck } from '@/lib/budget-db'

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
  const paychecks = getPaychecks(auth.userId)
  const nextPaycheck = getNextPaycheckDate(auth.userId)
  return NextResponse.json({ paychecks, nextPaycheck })
}

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Partial<BudgetPaycheck>
    if (!body.check_date && !body.pay_date) {
      return NextResponse.json({ error: 'Check date or pay date is required' }, { status: 400 })
    }
    const id = addPaycheck(auth.userId, body)
    return NextResponse.json({ success: true, id })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to add paycheck' }, { status: 500 })
  }
}
