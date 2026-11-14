import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getBankAccounts, addBankAccount } from '@/lib/budget-db'
import { validateLiabilityTerms } from '@/lib/utils/liability'

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

  const accounts = await getBankAccounts(auth.userId)
  return NextResponse.json({ accounts })
}

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const data = await request.json()
    if (auth.isExample) return NextResponse.json({ error: 'This account is read-only.' }, { status: 403 })
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 200) {
      return NextResponse.json({ error: 'Enter an account name between 1 and 200 characters.' }, { status: 400 })
    }
    const error = validateLiabilityTerms(data)
    if (error) return NextResponse.json({ error }, { status: 400 })
    const id = await addBankAccount(auth.userId, { ...data, name: data.name.trim(), ...(data.account_type === 'loan' ? { is_income_account: 0 } : {}) })
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create bank account' }, { status: 500 })
  }
}