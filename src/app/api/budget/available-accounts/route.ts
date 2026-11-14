import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { resolveBudgetUserId } from '@/lib/household-db'
import { getAvailableAccounts, saveAvailableAccounts } from '@/lib/available-accounts'

function authenticate(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  return token ? verifyToken(token) : null
}

export async function GET(request: NextRequest) {
  const auth = authenticate(request)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const userId = await resolveBudgetUserId(auth.userId)
    const accounts = await getAvailableAccounts(userId)
    return NextResponse.json({ accounts, canEdit: userId === auth.userId && !auth.isExample })
  } catch (error) {
    console.error('available accounts GET', error)
    return NextResponse.json({ error: 'Unable to load available accounts.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = authenticate(request)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (auth.isExample) return NextResponse.json({ error: 'This account is read-only.' }, { status: 403 })
  try {
    const userId = await resolveBudgetUserId(auth.userId)
    if (userId !== auth.userId) {
      return NextResponse.json({ error: 'Only the household budget owner can change available accounts.' }, { status: 403 })
    }
    let body: unknown
    try { body = await request.json() } catch {
      return NextResponse.json({ error: 'Send a valid account selection.' }, { status: 400 })
    }
    const ids = body && typeof body === 'object' && 'accountIds' in body ? body.accountIds : undefined
    if (!Array.isArray(ids) || ids.length > 1000 ||
      ids.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length) {
      return NextResponse.json({ error: 'Choose a valid list of accounts.' }, { status: 400 })
    }
    if (!await saveAvailableAccounts(userId, ids)) {
      return NextResponse.json({ error: 'An account is no longer available. Reopen the list and try again.' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('available accounts PUT', error)
    return NextResponse.json({ error: 'Unable to save available accounts.' }, { status: 500 })
  }
}
