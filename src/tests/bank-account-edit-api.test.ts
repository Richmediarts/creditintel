import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({
  auth: { userId: 1, isExample: false },
  get: vi.fn(), update: vi.fn(), balance: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ verifyToken: () => mocks.auth }))
vi.mock('@/lib/budget-db', () => ({
  getBankAccount: mocks.get, updateBankAccount: mocks.update,
  updateBankAccountBalance: mocks.balance, deleteBankAccount: vi.fn(),
}))
import { PUT } from '@/app/api/budget/bank-accounts/[id]/route'
const original = {
  id: 7, user_id: 1, name: 'EveryDay Checking', account_type: 'checking',
  institution: 'Navy Federal Credit Union', current_balance: 50,
  plaid_account_id: 'linked-account', plaid_item_id: 9,
  is_active: 1, is_income_account: 0, include_in_available: 0,
}
function request(body: unknown, authenticated = true) {
  return new NextRequest('http://localhost/api/budget/bank-accounts/7', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(authenticated ? { cookie: 'credit-dashboard-token=test' } : {}) },
    body: JSON.stringify(body),
  })
}
const params = { params: Promise.resolve({ id: '7' }) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { userId: 1, isExample: false }
  mocks.get.mockResolvedValue(original)
})
describe('bank account rename', () => {
  it('trims the new name and preserves balance, Plaid links and budget selection', async () => {
    const response = await PUT(request({ name: '  Navy Federal Checking  ' }), params)
    expect(response.status).toBe(200)
    expect(mocks.get).toHaveBeenCalledWith(1, 7)
    expect(mocks.update).toHaveBeenCalledWith(1, 7, { ...original, name: 'Navy Federal Checking' })
    expect(mocks.balance).not.toHaveBeenCalled()
  })
  it('preserves explicitly entered zero and negative balances', async () => {
    for (const current_balance of [0, -25.5]) {
      expect((await PUT(request({ name: original.name, current_balance }), params)).status).toBe(200)
      expect(mocks.update).toHaveBeenLastCalledWith(1, 7, { ...original, current_balance })
    }
  })
  it.each(['', '  ', 123, null, 'x'.repeat(201)])('rejects invalid names', async name => {
    expect((await PUT(request({ name }), params)).status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('requires authentication', async () => {
    expect((await PUT(request({ name: 'Checking' }, false), params)).status).toBe(401)
    expect(mocks.get).not.toHaveBeenCalled()
  })
  it('keeps example accounts read-only', async () => {
    mocks.auth.isExample = true
    expect((await PUT(request({ name: 'Checking' }), params)).status).toBe(403)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('rejects missing or other-user accounts before updating', async () => {
    mocks.get.mockResolvedValue(null)
    expect((await PUT(request({ name: 'Checking' }), params)).status).toBe(404)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('rejects invalid account ids and malformed bodies', async () => {
    expect((await PUT(request({ name: 'Checking' }), { params: Promise.resolve({ id: 'oops' }) })).status).toBe(400)
    expect((await PUT(request(null), params)).status).toBe(400)
    expect((await PUT(request([]), params)).status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('keeps the existing balance-only update supported', async () => {
    expect((await PUT(request({ balance: '0' }), params)).status).toBe(200)
    expect(mocks.balance).toHaveBeenCalledWith(1, 7, 0)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('rejects invalid balances', async () => {
    expect((await PUT(request({ current_balance: 'invalid' }), params)).status).toBe(400)
    expect((await PUT(request({ balance: '' }), params)).status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.balance).not.toHaveBeenCalled()
  })
})
