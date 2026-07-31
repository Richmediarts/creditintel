import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { Configuration, PlaidApi, PlaidEnvironments, TransactionsSyncRequest } from 'plaid'
import { getPlaidItems, getAccountsByPlaidItem, upsertPlaidTransaction, deletePlaidTransaction, updatePlaidCursor } from '@/lib/budget-db'

function getPlaidConfig() {
  const db = getDb()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'plaid_config'").get() as { value: string } | undefined
  if (row) {
    try { return JSON.parse(row.value) } catch { /* ignore */ }
  }
  return {
    client_id: process.env.PLAID_CLIENT_ID || '',
    secret: process.env.PLAID_SECRET || '',
    environment: process.env.PLAID_ENV || 'sandbox',
  }
}

function getPlaidClient(config: { client_id: string; secret: string; environment: string }) {
  const basePath = config.environment === 'production' ? PlaidEnvironments.production : PlaidEnvironments.sandbox
  const conf = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': config.client_id,
        'PLAID-SECRET': config.secret,
      },
    },
  })
  return new PlaidApi(conf)
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = getPlaidConfig()
  if (!config.client_id || !config.secret) {
    return NextResponse.json({ error: 'Plaid not configured' }, { status: 400 })
  }

  try {
    const client = getPlaidClient(config)
    const items = getPlaidItems(user.userId)
    const totals = { added: 0, modified: 0, removed: 0 }

    for (const item of items) {
      let cursorVal = item.plaid_cursor || ''
      let hasMore = true

      while (hasMore) {
        const req: TransactionsSyncRequest = { access_token: item.access_token, cursor: cursorVal }
        const res = await client.transactionsSync(req)
        const data = res.data

        const accountsMap = new Map(getAccountsByPlaidItem(user.userId, item.id).map(a => [a.plaid_account_id, a]))

        for (const tx of data.added) {
          const local = accountsMap.get(tx.account_id)
          if (!local) continue
          upsertPlaidTransaction(user.userId, local.id, tx.transaction_id, tx.date, tx.merchant_name || tx.name || '', -(tx.amount || 0), 0)
          totals.added++
        }
        for (const tx of data.modified) {
          const local = accountsMap.get(tx.account_id)
          if (!local) continue
          upsertPlaidTransaction(user.userId, local.id, tx.transaction_id, tx.date, tx.merchant_name || tx.name || '', -(tx.amount || 0), 0)
          totals.modified++
        }
        for (const tx of data.removed) {
          deletePlaidTransaction(tx.transaction_id)
          totals.removed++
        }

        cursorVal = data.next_cursor
        hasMore = data.has_more
      }

      if (cursorVal) updatePlaidCursor(user.userId, item.id, cursorVal)
    }

    const msg = `Synced: ${totals.added} added, ${totals.modified} modified, ${totals.removed} removed`
    return NextResponse.json({ success: true, message: msg, totals })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
