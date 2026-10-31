import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import {
  getIncomeSchedules, addIncomeSchedule, resolveBudgetUserId,
} from '@/lib/household-db'

function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return null
  return verifyToken(token)
}

/** GET — everyone's expected-income schedules in the household. */
export async function GET(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const budgetUserId = await resolveBudgetUserId(auth.userId)
  const includeInactive = new URL(request.url).searchParams.get('all') === 'true'
  const schedules = await getIncomeSchedules(budgetUserId, !includeInactive)
  return NextResponse.json({ schedules })
}

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    const data = await request.json()
    const budgetUserId = await resolveBudgetUserId(auth.userId)
    if (!data.pay_start_date) {
      return NextResponse.json({ error: 'A payday (pay_start_date) is required' }, { status: 400 })
    }
    const id = await addIncomeSchedule(budgetUserId, data)
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    console.error('schedules POST', error)
    return NextResponse.json({ error: 'Failed to create income schedule' }, { status: 500 })
  }
}
