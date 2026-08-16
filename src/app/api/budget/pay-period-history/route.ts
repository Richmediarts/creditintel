import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getPayPeriodHistory, PayPeriodGroup } from '@/lib/budget-db'

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

  const rawGroup = request.nextUrl.searchParams.get('group') || 'biweekly'
  const group: PayPeriodGroup = rawGroup === 'weekly' || rawGroup === 'monthly' ? rawGroup : 'biweekly'

  const periods = await getPayPeriodHistory(auth.userId, group)
  return NextResponse.json({ periods })
}