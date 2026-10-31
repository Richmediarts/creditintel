import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { resolveBudgetUserId, updateReserve, deleteReserve } from '@/lib/household-db'

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
    await updateReserve(budgetUserId, Number(id), data)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('reserves PUT', error)
    return NextResponse.json({ error: 'Failed to update reserve' }, { status: 500 })
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
    await deleteReserve(budgetUserId, Number(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('reserves DELETE', error)
    return NextResponse.json({ error: 'Failed to delete reserve' }, { status: 500 })
  }
}
