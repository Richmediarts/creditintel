import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const data = await request.json()
    const payments: { id: number; amount: number }[] = data.payments || []
    if (!Array.isArray(payments) || payments.length === 0) {
      return NextResponse.json({ error: 'No payments provided' }, { status: 400 })
    }

    const db = getDb()
    let updated = 0
    await db.transaction(async () => {
      for (const p of payments) {
        const id = Number(p.id)
        const amount = Number(p.amount)
        if (!Number.isFinite(id) || !Number.isFinite(amount) || amount === 0) continue
        const result = await db.prepare(
          'UPDATE budget_credit_cards SET current_balance = GREATEST(0, current_balance - ?) WHERE user_id = ? AND id = ?'
        ).run(amount, auth.userId, id)
        updated += result.changes
      }
    })

    return NextResponse.json({ success: true, updated })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to apply payoff' }, { status: 500 })
  }
}
