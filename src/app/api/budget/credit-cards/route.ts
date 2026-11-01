import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getCreditCards, getCreditCard, addCreditCard, updateCreditCard, deleteCreditCard, clearCreditCardPlaid, getBillsByCreditCard } from '@/lib/budget-db'

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

  try {
    // Listing cards is read-only. An unrelated bill sync must never hide cards.
    const cards = await getCreditCards(auth.userId)
    return NextResponse.json({ cards })
  } catch (error) {
    console.error('credit cards GET failed', error)
    return NextResponse.json({ error: 'Unable to load credit cards. Please try again.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const data = await request.json()
    const id = await addCreditCard(auth.userId, data)
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create credit card' }, { status: 500 })
  }
}