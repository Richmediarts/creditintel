import { getDb } from '@/lib/db'

export interface AvailableAccount {
  id: number
  name: string
  accountType: string
  balance: number
  included: boolean
}

export async function getAvailableAccounts(userId: number): Promise<AvailableAccount[]> {
  const rows = await getDb().prepare(`
    SELECT id, name, account_type, current_balance, include_in_available
    FROM budget_bank_accounts
    WHERE user_id = ? AND is_active = 1 AND account_type != 'loan'
    ORDER BY name, id
  `).all(userId) as {
    id: number; name: string; account_type: string
    current_balance: number; include_in_available: number
  }[]
  return rows.map(row => ({
    id: row.id, name: row.name, accountType: row.account_type,
    balance: Number(row.current_balance) || 0,
    included: Number(row.include_in_available) === 1,
  }))
}

/** Replace the selection in one statement, including an intentionally empty selection. */
export async function saveAvailableAccounts(userId: number, ids: number[]): Promise<boolean> {
  const accounts = await getAvailableAccounts(userId)
  const eligible = new Set(accounts.map(account => account.id))
  if (ids.some(id => !eligible.has(id))) return false
  const selection = ids.length ? `CASE WHEN id IN (${ids.map(() => '?').join(',')}) THEN 1 ELSE 0 END` : '0'
  await getDb().prepare(`
    UPDATE budget_bank_accounts SET include_in_available = ${selection}
    WHERE user_id = ? AND is_active = 1 AND account_type != 'loan'
  `).run(...ids, userId)
  return true
}
