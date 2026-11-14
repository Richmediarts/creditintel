import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
const state = vi.hoisted(() => ({ db: {} as { prepare: (query: string) => unknown } }))
vi.mock('@/lib/db', () => ({ getDb: () => state.db }))
import { addBankAccount, updateBankAccount } from '@/lib/budget-db'
import { getAvailableAccounts } from '@/lib/available-accounts'
let sqlite: Database.Database
beforeEach(() => {
  sqlite = new Database(':memory:')
  sqlite.exec(`CREATE TABLE budget_bank_accounts (
    id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT, account_type TEXT,
    institution TEXT, account_number_last4 TEXT, current_balance REAL,
    website TEXT, is_active INTEGER, is_income_account INTEGER, interest_rate REAL,
    plaid_account_id TEXT, plaid_item_id INTEGER, loan_kind TEXT DEFAULT 'other',
    monthly_payment REAL, include_in_available INTEGER DEFAULT 1, liens TEXT DEFAULT '[]', principal_interest_payment REAL
  )`)
  state.db = { prepare: (query: string) => ({
    all: async (...args: unknown[]) => sqlite.prepare(query).all(...args),
    run: async (...args: unknown[]) => {
      const stmt = sqlite.prepare(query)
      if (query.includes('RETURNING')) return { lastInsertRowid: (stmt.get(...args) as { id: number }).id }
      return stmt.run(...args)
    },
  }) }
})
afterEach(() => sqlite.close())
describe('liability persistence and asset separation', () => {
  it('stores a law settlement with unknown APR and payment without counting it as cash', async () => {
    const id = await addBankAccount(1, { name: 'WoodStock - Law Settlement', account_type: 'loan', loan_kind: 'settlement', current_balance: 1000 })
    expect(sqlite.prepare('SELECT loan_kind,interest_rate,monthly_payment,current_balance FROM budget_bank_accounts WHERE id=?').get(id))
      .toEqual({ loan_kind: 'settlement', interest_rate: null, monthly_payment: null, current_balance: 1000 })
    expect(await getAvailableAccounts(1)).toEqual([])
  })
  it('preserves loan terms and account links when a sync updates only the balance', async () => {
    const id = await addBankAccount(1, { name: 'Auto Loan', account_type: 'loan', loan_kind: 'auto', current_balance: 10000, interest_rate: 6.5, monthly_payment: 300, plaid_account_id: 'linked' })
    await updateBankAccount(1, id, { current_balance: 9800 })
    expect(sqlite.prepare('SELECT loan_kind,interest_rate,monthly_payment,plaid_account_id,current_balance FROM budget_bank_accounts WHERE id=?').get(id))
      .toEqual({ loan_kind: 'auto', interest_rate: 6.5, monthly_payment: 300, plaid_account_id: 'linked', current_balance: 9800 })
  })
  it('allows explicitly clearing APR and payment, and scopes updates to the owner', async () => {
    const id = await addBankAccount(1, { name: 'Auto Loan', account_type: 'loan', current_balance: 1000, interest_rate: 5, monthly_payment: 100 })
    await updateBankAccount(2, id, { current_balance: 0 })
    await updateBankAccount(1, id, { interest_rate: null, monthly_payment: null })
    expect(sqlite.prepare('SELECT current_balance,interest_rate,monthly_payment FROM budget_bank_accounts WHERE id=?').get(id))
      .toEqual({ current_balance: 1000, interest_rate: null, monthly_payment: null })
  })
})

describe('mortgage lien storage', () => {
  it('persists mortgage, liens and escrow-excluded payoff payment without creating duplicate cash accounts', async () => {
    const liens = [{ name: 'HUD FHA partial claim', amount: 20441.75 }, { name: 'Midland judgment (Ella)', amount: 7106.10 }]
    const id = await addBankAccount(1, { name: 'PennyMac', account_type: 'loan', loan_kind: 'mortgage',
      current_balance: 221897.84, interest_rate: 3.125, monthly_payment: 1776.46, principal_interest_payment: 1093.60, liens })
    await updateBankAccount(1, id, { current_balance: 221000 })
    const stored = sqlite.prepare('SELECT liens,principal_interest_payment,current_balance FROM budget_bank_accounts WHERE id=?').get(id) as { liens: string; principal_interest_payment: number; current_balance: number }
    expect(JSON.parse(stored.liens)).toEqual(liens)
    expect(stored.principal_interest_payment).toBe(1093.60)
    expect(stored.current_balance).toBe(221000)
    expect(await getAvailableAccounts(1)).toEqual([])
  })
})
