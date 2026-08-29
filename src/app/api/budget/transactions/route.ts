import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { getRecentTransactions, getTransactionsFiltered, getSpendingByCategory, getDistinctTransactionCategories } from '@/lib/budget-db'

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
  const kind = searchParams.get('kind')
  const limit = Number(searchParams.get('limit')) || 10

  if (kind === 'bank' || kind === 'credit') {
    const transactions = await getRecentTransactions(auth.userId, kind, limit)
    return NextResponse.json({ transactions })
  }

  const accountId = searchParams.get('account_id')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const category = searchParams.get('category')
  const accountKind = searchParams.get('account_kind') as 'bank' | 'credit' | null

  const transactions = await getTransactionsFiltered(auth.userId, {
    accountId: accountId ? Number(accountId) : undefined,
    kind: accountKind === 'bank' || accountKind === 'credit' ? accountKind : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    category: category || undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 2000,
  })

  let byCategory: { category: string; count: number; spend: number }[] = []
  let categories: string[] = []
  if (startDate && endDate) {
    byCategory = await getSpendingByCategory(auth.userId, startDate, endDate)
    categories = await getDistinctTransactionCategories(auth.userId, startDate, endDate)
  }

  return NextResponse.json({ transactions, byCategory, categories })
}

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const data = await request.json()
    const db = getDb()
    
    // Get running balance for this account
    const lastTx = await db.get(
      'SELECT balance FROM budget_transactions WHERE user_id = ? AND account_id = ? ORDER BY date DESC, created_at DESC LIMIT 1',
      [auth.userId, data.account_id]
    ) as { balance: number } | undefined
    
    const runningBalance = (lastTx?.balance || 0) + Number(data.amount)
    
    const result = await db.run(
      'INSERT INTO budget_transactions (user_id, account_id, date, description, amount, balance) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [auth.userId, data.account_id, data.date, data.description, data.amount, runningBalance]
    )
    
    return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}