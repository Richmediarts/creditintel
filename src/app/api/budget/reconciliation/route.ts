import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { resolveBudgetUserId } from '@/lib/household-db'
import { getPayPeriodReconciliation } from '@/lib/payperiod-planner'

function authenticate(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  return token ? verifyToken(token) : null
}

export async function GET(request: NextRequest) {
  const auth = authenticate(request)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const payday = request.nextUrl.searchParams.get('payday') || undefined
  const periods = Number(request.nextUrl.searchParams.get('periods') || 6)
  if (!Number.isInteger(periods) || periods < 1 || periods > 12 ||
    (payday && (!/^\d{4}-\d{2}-\d{2}$/.test(payday) ||
      !Number.isFinite(Date.parse(payday)) || new Date(payday).toISOString().slice(0, 10) !== payday))) {
    return NextResponse.json({ error: 'Use a valid payday and 1–12 periods.' }, { status: 400 })
  }
  try {
    const userId = await resolveBudgetUserId(auth.userId)
    const reconciliation = await getPayPeriodReconciliation(userId, { payday, periods })
    const db = getDb()
    const accounts = await db.prepare(`
      SELECT id, name, owner, 'bank' AS kind FROM budget_bank_accounts WHERE user_id = ?
      UNION ALL
      SELECT id, name, owner, 'credit' AS kind FROM budget_credit_cards WHERE user_id = ?
      ORDER BY kind, name
    `).all(userId, userId)
    return NextResponse.json({ reconciliation, accounts, canEdit: userId === auth.userId && !auth.isExample })
  } catch (error) {
    console.error('reconciliation GET failed', error)
    return NextResponse.json({ error: 'Unable to compare this plan with recorded transactions.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = authenticate(request)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (auth.isExample) return NextResponse.json({ error: 'This account is read-only.' }, { status: 403 })
  try {
    const userId = await resolveBudgetUserId(auth.userId)
    if (userId !== auth.userId) return NextResponse.json({ error: 'Only the budget owner can assign accounts.' }, { status: 403 })
    const { id, kind, owner } = await request.json()
    if (!Number.isInteger(id) || id < 1 || !['bank', 'credit'].includes(kind) || !['me', 'wife', 'shared'].includes(owner)) {
      return NextResponse.json({ error: 'Choose a valid account and owner.' }, { status: 400 })
    }
    const table = kind === 'bank' ? 'budget_bank_accounts' : 'budget_credit_cards'
    const result = await getDb().prepare(`UPDATE ${table} SET owner = ? WHERE id = ? AND user_id = ?`).run(owner, id, userId)
    if (!result.changes) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('reconciliation PATCH failed', error)
    return NextResponse.json({ error: 'Unable to save account owner.' }, { status: 500 })
  }
}
