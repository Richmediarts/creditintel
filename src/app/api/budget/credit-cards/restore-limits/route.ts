import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

const LIMITS: Record<string, number> = {
  '8382': 400,
  '5443': 650,
  '7220': 900,
  '8259': 501,
  '4550': 300,
  '5847': 1000,
  '7200': 1400,
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  let restored = 0

  for (const [lastFour, limit] of Object.entries(LIMITS)) {
    const result = await db.run(
      'UPDATE budget_credit_cards SET credit_limit = ? WHERE user_id = ? AND last_four = ? AND (credit_limit = 0 OR credit_limit IS NULL)',
      [limit, user.userId, lastFour]
    )
    restored += (result.changes as number)
  }

  const paypal = await db.run(
    "UPDATE budget_credit_cards SET credit_limit = 1160 WHERE user_id = ? AND name LIKE '%PayPal%' AND (credit_limit = 0 OR credit_limit IS NULL)",
    [user.userId]
  )
  restored += (paypal.changes as number)

  return NextResponse.json({ restored })
}
