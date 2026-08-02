import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getPaycheck, updatePaycheck, deletePaycheck } from '@/lib/budget-db'
import type { BudgetPaycheck } from '@/lib/budget-db'

function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const paycheck = await getPaycheck(auth.userId, Number(id))
  if (!paycheck) {
    return NextResponse.json({ error: 'Paycheck not found' }, { status: 404 })
  }
  return NextResponse.json({ paycheck })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    const body = (await request.json()) as Partial<BudgetPaycheck>
    const existing = await getPaycheck(auth.userId, Number(id))
    if (!existing) {
      return NextResponse.json({ error: 'Paycheck not found' }, { status: 404 })
    }
    await updatePaycheck(auth.userId, Number(id), body)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to update paycheck' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await deletePaycheck(auth.userId, Number(id))
  return NextResponse.json({ success: true })
}
