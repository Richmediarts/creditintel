import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

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
  const accountId = searchParams.get('account_id')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')

  const db = getDb()
  let query = 'SELECT * FROM budget_transactions WHERE user_id = ?'
  const params: unknown[] = [auth.userId]

  if (accountId) {
    query += ' AND account_id = ?'
    params.push(Number(accountId))
  }
  if (startDate) {
    query += ' AND date >= ?'
    params.push(startDate)
  }
  if (endDate) {
    query += ' AND date <= ?'
    params.push(endDate)
  }

  query += ' ORDER BY date DESC, created_at DESC'

  const transactions = await db.all(query, params)
  return NextResponse.json({ transactions })
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