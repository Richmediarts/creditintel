import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { TransactionsSyncRequest, TransactionsGetRequest } from 'plaid'
import { getPlaidConfig, getPlaidClient, requirePlaidConfig } from '@/lib/plaid-client'
import { getPlaidItems, getAccountsByPlaidItem, upsertPlaidTransaction, deletePlaidTransaction, updatePlaidCursor } from '@/lib/budget-db'

const RECONNECT_CODES = new Set([
  'ITEM_LOGIN_REQUIRED',
  'NO_ACCOUNTS',
  'ACCESS_NOT_GRANTED',
  'INVALID_TOKEN',
  'ITEM_NOT_FOUND',
])

const BACKFILL_DAYS = 90

function plaidErrorCode(e: unknown): string | undefined {
  const err = e as { response?: { data?: { error_code?: string } } }
  return err.response?.data?.error_code
}

function summarizeReconnect(failed: { institution: string; code: string }[]): string {
  const counts = new Map<string, number>()
  for (const f of failed) counts.set(f.institution, (counts.get(f.institution) || 0) + 1)
  return [...counts.entries()].map(([name, n]) => (n > 1 ? `${name} (${n})` : name)).join(', ')
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

interface PlaidTx {
  account_id: string
  transaction_id: string
  date: string
  amount: number
  name: string
  merchant_name?: string
  personal_finance_category?: { primary?: string; detailed?: string }
}

async function backfillItem(
  client: ReturnType<typeof getPlaidClient>,
  accessToken: string,
  userId: number,
  itemPk: number
) {
  const startDate = isoDaysAgo(BACKFILL_DAYS)
  const endDate = isoDaysAgo(0)
  const accountsMap = new Map((await getAccountsByPlaidItem(userId, itemPk)).map(a => [a.plaid_account_id, a]))
  let offset = 0
  let saved = 0
  let total = Infinity

  while (offset < total) {
    const req: TransactionsGetRequest = {
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count: 500, offset, include_personal_finance_category: true },
    }
    const res = await client.transactionsGet(req)
    const data = res.data
    total = data.total_transactions

    for (const tx of (data.transactions as unknown as PlaidTx[])) {
      const local = accountsMap.get(tx.account_id)
      if (!local) continue
      const pfc = tx.personal_finance_category
      await upsertPlaidTransaction(
        userId, local.id, tx.transaction_id, tx.date,
        tx.merchant_name || tx.name || '', -(tx.amount || 0), 0,
        local.type === 'credit', pfc?.primary ?? null, pfc?.detailed ?? null
      )
      saved++
    }

    if (data.transactions.length === 0) break
    offset += data.transactions.length
  }

  return saved
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let full = false
  try {
    const body = await request.json()
    full = Boolean(body?.full)
  } catch { /* no body */ }

  const config = await getPlaidConfig()
  if (!requirePlaidConfig(config)) {
    return NextResponse.json({ error: 'Plaid not configured' }, { status: 400 })
  }

  const client = getPlaidClient(config)
  const items = await getPlaidItems(user.userId)
  if (items.length === 0) {
    return NextResponse.json({ success: true, message: 'No Plaid accounts linked yet.', totals: { added: 0, modified: 0, removed: 0, backfilled: 0 }, reconnectNeeded: [] })
  }

  const totals = { added: 0, modified: 0, removed: 0, backfilled: 0 }
  const reconnectNeeded: { institution: string; code: string }[] = []
  const db = getDb()

  for (const item of items) {
    try {
      // Optional 90-day history backfill (captures Plaid personal-finance categories)
      if (full) {
        totals.backfilled += await backfillItem(client, item.access_token, user.userId, item.id)
      }

      // Incremental cursor sync (new / modified / removed since last sync)
      let cursorVal = item.plaid_cursor || ''
      let hasMore = true

      while (hasMore) {
        const req: TransactionsSyncRequest = {
          access_token: item.access_token,
          cursor: cursorVal,
          options: { include_personal_finance_category: true },
        }
        const res = await client.transactionsSync(req)
        const data = res.data

        const accountsMap = new Map((await getAccountsByPlaidItem(user.userId, item.id)).map(a => [a.plaid_account_id, a]))

        for (const tx of data.added) {
          const local = accountsMap.get(tx.account_id)
          if (!local) continue
          const pfc = tx.personal_finance_category
          await upsertPlaidTransaction(user.userId, local.id, tx.transaction_id, tx.date, tx.merchant_name || tx.name || '', -(tx.amount || 0), 0, local.type === 'credit', pfc?.primary ?? null, pfc?.detailed ?? null)
          totals.added++
        }
        for (const tx of data.modified) {
          const local = accountsMap.get(tx.account_id)
          if (!local) continue
          const pfc = tx.personal_finance_category
          await upsertPlaidTransaction(user.userId, local.id, tx.transaction_id, tx.date, tx.merchant_name || tx.name || '', -(tx.amount || 0), 0, local.type === 'credit', pfc?.primary ?? null, pfc?.detailed ?? null)
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

  const parts: string[] = []
  if (full && totals.backfilled > 0) parts.push(`${totals.backfilled} backfilled (last ${BACKFILL_DAYS} days)`)
  parts.push(`${totals.added} new, ${totals.modified} modified, ${totals.removed} removed`)
  let msg = `Synced: ${parts.join('; ')}`
  if (reconnectNeeded.length > 0) {
    msg += `; ${reconnectNeeded.length} Plaid link${reconnectNeeded.length === 1 ? '' : 's'} need reconnection (${summarizeReconnect(reconnectNeeded)}). Re-link them for their transactions to flow.`
  }
  return NextResponse.json({ success: true, message: msg, totals, reconnectNeeded })
}