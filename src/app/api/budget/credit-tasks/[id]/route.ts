import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { resolveBudgetUserId, updateCreditTask, deleteCreditTask } from '@/lib/household-db'

function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    const { id } = await params
    const data = await request.json()
    const budgetUserId = await resolveBudgetUserId(auth.userId)
    await updateCreditTask(budgetUserId, Number(id), data)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('credit-tasks PUT', error)
    return NextResponse.json({ error: 'Failed to update credit task' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    const { id } = await params
    const budgetUserId = await resolveBudgetUserId(auth.userId)
    await deleteCreditTask(budgetUserId, Number(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('credit-tasks DELETE', error)
    return NextResponse.json({ error: 'Failed to delete credit task' }, { status: 500 })
  }
}
