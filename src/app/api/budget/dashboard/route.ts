import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getPayPeriodDashboard } from '@/lib/payperiod-planner'

function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return null
  return verifyToken(token)
}

/**
 * GET /api/budget/dashboard?payday=YYYY-MM-DD&periods=6
 *
 * The biweekly pay-period dashboard: per-spouse income, bills in each window,
 * reserves, allowances, shortfall and the plain-language money explanation.
 * This endpoint resolves to the household owner's budget automatically.
 */
export async function GET(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const payDay = searchParams.get('payday') || undefined
    const periods = Number(searchParams.get('periods')) || 6
    const budgetUserId = await resolveBudget(auth.userId)
    const dashboard = await getPayPeriodDashboard(budgetUserId, { payday: payDay, periods })
    return NextResponse.json({ dashboard })
  } catch (error) {
    console.error('dashboard error', error)
    return NextResponse.json({ error: 'Failed to build pay-period dashboard' }, { status: 500 })
  }
}

async function resolveBudget(authUserId: number): Promise<number> {
  const { resolveBudgetUserId } = await import('@/lib/household-db')
  return resolveBudgetUserId(authUserId)
}
