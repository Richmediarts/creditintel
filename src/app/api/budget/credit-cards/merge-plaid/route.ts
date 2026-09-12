import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { getPlaidItems } from '@/lib/budget-db'
import { getPlaidConfig, getPlaidClient, requirePlaidConfig } from '@/lib/plaid-client'
import { AccountsGetRequest } from 'plaid'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await getPlaidConfig()
  if (!requirePlaidConfig(config)) {
    return NextResponse.json({ error: 'Plaid not configured' }, { status: 400 })
  }

  const db = getDb()
  const client = getPlaidClient(config)
  const items = await getPlaidItems(user.userId)
  if (items.length === 0) return NextResponse.json({ merged: 0 })

  let merged = 0

  for (const item of items) {
    try {
      const req: AccountsGetRequest = { access_token: item.access_token }
      const res = await client.accountsGet(req)
      const accounts = res.data.accounts

      for (const acct of accounts) {
        if (acct.type !== 'credit') continue
        const mask = acct.mask || ''
        if (!mask) continue

        const existingLinked = await db.prepare(
          'SELECT id FROM budget_credit_cards WHERE user_id = ? AND plaid_account_id = ?'
        ).get(user.userId, acct.account_id) as { id: number } | undefined
        if (existingLinked) continue

        const unlinked = await db.prepare(
          'SELECT id FROM budget_credit_cards WHERE user_id = ? AND last_four = ? AND plaid_item_id IS NULL'
        ).get(user.userId, mask) as { id: number } | undefined

        if (unlinked) {
          const plaidLimit = acct.balances?.limit ?? 0
          await db.prepare(
            'UPDATE budget_credit_cards SET plaid_account_id = ?, plaid_item_id = ?, current_balance = ?, credit_limit = CASE WHEN ? > 0 THEN ? ELSE credit_limit END WHERE user_id = ? AND id = ?'
          ).run(
            acct.account_id,
            item.id,
            acct.balances?.current ?? 0,
            plaidLimit,
            plaidLimit,
            user.userId,
            unlinked.id
          )
          merged++
        }
      }
    } catch { /* skip items that fail */ }
  }

  return NextResponse.json({ merged })
}
