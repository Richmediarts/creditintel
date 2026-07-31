import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getBills, getUnpaidBills, getBill, addBill, updateBill, updateBillField, markBillPaid, markBillUnpaid, deleteBill } from '@/lib/budget-db'

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

  const { searchParams } = new URL(request.url)
  const unpaidOnly = searchParams.get('unpaid') === 'true'
  const bills = unpaidOnly ? getUnpaidBills(auth.userId) : getBills(auth.userId)
  return NextResponse.json({ bills })
}

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const data = await request.json()
    const id = addBill(auth.userId, data)
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 })
  }
}