import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { AccountsBalanceGetRequest } from 'plaid'
import { getPlaidConfig, getPlaidClient, requirePlaidConfig } from '@/lib/plaid-client'
import { getPlaidItems } from '@/lib/budget-db'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await getPlaidConfig()
  if (!requirePlaidConfig(config)) {
    return NextResponse.json({ error: 'Plaid not configured' }, { status: 400 })
  }

  try {
    const client = getPlaidClient(config)
    const items = await getPlaidItems(user.userId)
    const results: { item: string; status: string; error?: string }[] = []
    const db = getDb()

    for (const item of items) {
      try {
        const req: AccountsBalanceGetRequest = { access_token: item.access_token }
        const res = await client.accountsBalanceGet(req)
        for (const acct of res.data.accounts) {
          const aid = acct.account_id
          const balances = acct.balances || {}
          const balance = acct.type === 'depository'
            ? (balances.available ?? balances.current ?? 0)
            : (balances.current ?? 0)
          const limitVal = balances.limit || 0

          const updated = await db.run('UPDATE budget_bank_accounts SET current_balance = ?, last_synced_at = CURRENT_TIMESTAMP WHERE user_id = ? AND plaid_account_id = ?', [balance, user.userId, aid])
          if (updated.changes === 0) {
            await db.run('UPDATE budget_credit_cards SET current_balance = ?, credit_limit = ?, last_synced_at = CURRENT_TIMESTAMP WHERE user_id = ? AND plaid_account_id = ?', [balance, limitVal, user.userId, aid])
          }
        }
        results.push({ item: item.institution_name || '', status: 'ok' })
      } catch (e: unknown) {
        const plaidCode = (e as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code
        if (plaidCode === 'NO_ACCOUNTS') {
          results.push({ item: item.institution_name || '', status: 'skipped' })
        } else {
          results.push({ item: item.institution_name || '', status: 'error', error: e instanceof Error ? e.message : String(e) })
        }
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
