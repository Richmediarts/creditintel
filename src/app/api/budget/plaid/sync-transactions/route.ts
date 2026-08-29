import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { TransactionsSyncRequest } from 'plaid'
import { getPlaidConfig, getPlaidClient, requirePlaidConfig } from '@/lib/plaid-client'
import { getPlaidItems, getAccountsByPlaidItem, upsertPlaidTransaction, deletePlaidTransaction, updatePlaidCursor } from '@/lib/budget-db'

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
    const totals = { added: 0, modified: 0, removed: 0 }
    const db = getDb()

    for (const item of items) {
      let cursorVal = item.plaid_cursor || ''
      let hasMore = true

      while (hasMore) {
        const req: TransactionsSyncRequest = { access_token: item.access_token, cursor: cursorVal }
        const res = await client.transactionsSync(req)
        const data = res.data

        const accountsMap = new Map((await getAccountsByPlaidItem(user.userId, item.id)).map(a => [a.plaid_account_id, a]))

        for (const tx of data.added) {
          const local = accountsMap.get(tx.account_id)
          if (!local) continue
          await upsertPlaidTransaction(user.userId, local.id, tx.transaction_id, tx.date, tx.merchant_name || tx.name || '', -(tx.amount || 0), 0)
          totals.added++
        }
        for (const tx of data.modified) {
          const local = accountsMap.get(tx.account_id)
          if (!local) continue
          await upsertPlaidTransaction(user.userId, local.id, tx.transaction_id, tx.date, tx.merchant_name || tx.name || '', -(tx.amount || 0), 0)
          totals.modified++
        }
        for (const tx of data.removed) {
          await deletePlaidTransaction(tx.transaction_id)
          totals.removed++
        }

        cursorVal = data.next_cursor
        hasMore = data.has_more
      }

      if (cursorVal) await updatePlaidCursor(user.userId, item.id, cursorVal)

      const localAccounts = await getAccountsByPlaidItem(user.userId, item.id)
      for (const a of localAccounts) {
        await db.run('UPDATE budget_bank_accounts SET last_synced_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ?', [user.userId, a.id])
      }
    }

    const msg = `Synced: ${totals.added} added, ${totals.modified} modified, ${totals.removed} removed`
    return NextResponse.json({ success: true, message: msg, totals })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
