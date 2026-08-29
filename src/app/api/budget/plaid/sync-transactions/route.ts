import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { TransactionsSyncRequest } from 'plaid'
import { getPlaidConfig, getPlaidClient, requirePlaidConfig } from '@/lib/plaid-client'
import { getPlaidItems, getAccountsByPlaidItem, upsertPlaidTransaction, deletePlaidTransaction, updatePlaidCursor } from '@/lib/budget-db'

const RECONNECT_CODES = new Set([
  'ITEM_LOGIN_REQUIRED',
  'NO_ACCOUNTS',
  'ACCESS_NOT_GRANTED',
  'INVALID_TOKEN',
  'ITEM_NOT_FOUND',
])

function plaidErrorCode(e: unknown): string | undefined {
  const err = e as { response?: { data?: { error_code?: string } } }
  return err.response?.data?.error_code
}

function summarizeReconnect(failed: { institution: string; code: string }[]): string {
  const counts = new Map<string, number>()
  for (const f of failed) counts.set(f.institution, (counts.get(f.institution) || 0) + 1)
  return [...counts.entries()].map(([name, n]) => (n > 1 ? `${name} (${n})` : name)).join(', ')
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await getPlaidConfig()
  if (!requirePlaidConfig(config)) {
    return NextResponse.json({ error: 'Plaid not configured' }, { status: 400 })
  }

  const client = getPlaidClient(config)
  const items = await getPlaidItems(user.userId)
  if (items.length === 0) {
    return NextResponse.json({ success: true, message: 'No Plaid accounts linked yet.', totals: { added: 0, modified: 0, removed: 0 }, reconnectNeeded: [] })
  }

  const totals = { added: 0, modified: 0, removed: 0 }
  const reconnectNeeded: { institution: string; code: string }[] = []
  const db = getDb()

  for (const item of items) {
    try {
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
          await upsertPlaidTransaction(user.userId, local.id, tx.transaction_id, tx.date, tx.merchant_name || tx.name || '', -(tx.amount || 0), 0, local.type === 'credit')
          totals.added++
        }
        for (const tx of data.modified) {
          const local = accountsMap.get(tx.account_id)
          if (!local) continue
          await upsertPlaidTransaction(user.userId, local.id, tx.transaction_id, tx.date, tx.merchant_name || tx.name || '', -(tx.amount || 0), 0, local.type === 'credit')
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
        const table = a.type === 'credit' ? 'budget_credit_cards' : 'budget_bank_accounts'
        await db.run(`UPDATE ${table} SET last_synced_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ?`, [user.userId, a.id])
      }
    } catch (e) {
      const code = plaidErrorCode(e)
      if (code && RECONNECT_CODES.has(code)) {
        reconnectNeeded.push({ institution: item.institution_name, code })
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        return NextResponse.json({ error: msg }, { status: 500 })
      }
    }
  }

  let msg = `Synced: ${totals.added} added, ${totals.modified} modified, ${totals.removed} removed`
  if (reconnectNeeded.length > 0) {
    msg += `; ${reconnectNeeded.length} Plaid link${reconnectNeeded.length === 1 ? '' : 's'} need reconnection (${summarizeReconnect(reconnectNeeded)}). Re-link them for their transactions to flow.`
  }
  return NextResponse.json({ success: true, message: msg, totals, reconnectNeeded })
}