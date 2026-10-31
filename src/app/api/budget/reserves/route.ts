import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { resolveBudgetUserId, getReserves, addReserve } from '@/lib/household-db'

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
  const budgetUserId = await resolveBudgetUserId(auth.userId)
  const reserves = await getReserves(budgetUserId)
  return NextResponse.json({ reserves })
}

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    const data = await request.json()
    const budgetUserId = await resolveBudgetUserId(auth.userId)
    if (!data.name?.trim()) {
      return NextResponse.json({ error: 'A name is required' }, { status: 400 })
    }
    const id = await addReserve(budgetUserId, data)
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    console.error('reserves POST', error)
    return NextResponse.json({ error: 'Failed to create reserve' }, { status: 500 })
  }
}
