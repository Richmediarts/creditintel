import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { resolveBudgetUserId, getCreditTasks, addCreditTask } from '@/lib/household-db'

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
  const tasks = await getCreditTasks(budgetUserId)
  return NextResponse.json({ tasks })
}

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    const data = await request.json()
    if (!data.title?.trim()) {
      return NextResponse.json({ error: 'A title is required' }, { status: 400 })
    }
    const budgetUserId = await resolveBudgetUserId(auth.userId)
    const id = await addCreditTask(budgetUserId, data)
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    console.error('credit-tasks POST', error)
    return NextResponse.json({ error: 'Failed to create credit task' }, { status: 500 })
  }
}
