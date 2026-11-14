import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ all: vi.fn(), run: vi.fn(), prepare: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ prepare: mocks.prepare }) }))
import { getAvailableAccounts, saveAvailableAccounts } from '@/lib/available-accounts'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.prepare.mockReturnValue({ all: mocks.all, run: mocks.run })
  mocks.all.mockResolvedValue([
    { id: 1, name: 'Checking', account_type: 'checking', current_balance: -20.25, include_in_available: 1 },
    { id: 2, name: 'Savings', account_type: 'savings', current_balance: 3400.30, include_in_available: 0 },
  ])
})

describe('available bank account selection', () => {
  it('loads active non-loan accounts scoped to the budget owner and preserves negative balances', async () => {
    const accounts = await getAvailableAccounts(42)
    expect(mocks.prepare.mock.calls[0][0]).toContain("user_id = ? AND is_active = 1 AND account_type != 'loan'")
    expect(mocks.all).toHaveBeenCalledWith(42)
    expect(accounts[0]).toMatchObject({ balance: -20.25, included: true })
    expect(accounts[1].included).toBe(false)
  })
  it('rejects foreign, inactive, loan or deleted account ids without writing', async () => {
    expect(await saveAvailableAccounts(42, [999])).toBe(false)
    expect(mocks.run).not.toHaveBeenCalled()
  })
  it('saves the entire selection in one owner-scoped update', async () => {
    expect(await saveAvailableAccounts(42, [2])).toBe(true)
    expect(mocks.prepare.mock.calls[1][0]).toContain('CASE WHEN id IN (?) THEN 1 ELSE 0 END')
    expect(mocks.prepare.mock.calls[1][0]).toContain("user_id = ? AND is_active = 1 AND account_type != 'loan'")
    expect(mocks.run).toHaveBeenCalledWith(2, 42)
  })
  it('persists an empty selection instead of reverting to all accounts', async () => {
    expect(await saveAvailableAccounts(42, [])).toBe(true)
    expect(mocks.prepare.mock.calls[1][0]).toContain('SET include_in_available = 0')
    expect(mocks.run).toHaveBeenCalledWith(42)
  })
})
