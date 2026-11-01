import { DuplicateCardBillError } from '@/lib/utils/card-bill-links'
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
  const bills = unpaidOnly ? await getUnpaidBills(auth.userId) : await getBills(auth.userId)
  return NextResponse.json({ bills })
}

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const data = await request.json()
    const id = await addBill(auth.userId, data)
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    if (error instanceof DuplicateCardBillError) return NextResponse.json({ error: error.message, billId: error.billId }, { status: 409 })
    const conflict = error as { code?: string; constraint?: string }
    if (conflict?.code === '23505' && conflict.constraint === 'budget_one_recurring_bill_per_card') return NextResponse.json({ error: 'This card already has a recurring bill. Edit the existing bill instead.' }, { status: 409 })
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 })
  }
}