import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({
  auth: { userId: 1, isExample: false }, owner: 1,
  get: vi.fn(), save: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ verifyToken: () => mocks.auth }))
vi.mock('@/lib/household-db', () => ({ resolveBudgetUserId: async () => mocks.owner }))
vi.mock('@/lib/available-accounts', () => ({ getAvailableAccounts: mocks.get, saveAvailableAccounts: mocks.save }))
import { GET, PUT } from '@/app/api/budget/available-accounts/route'
function request(method: string, body?: unknown, authenticated = true) {
  return new NextRequest('http://localhost/api/budget/available-accounts', {
    method, headers: { 'content-type': 'application/json', ...(authenticated ? { cookie: 'credit-dashboard-token=test' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { userId: 1, isExample: false }
  mocks.owner = 1
  mocks.get.mockResolvedValue([])
  mocks.save.mockResolvedValue(true)
})
describe('available accounts API authorization', () => {
  it('requires authentication for both reads and writes', async () => {
    expect((await GET(request('GET', undefined, false))).status).toBe(401)
    expect((await PUT(request('PUT', { accountIds: [] }, false))).status).toBe(401)
    expect(mocks.get).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('reads the household plan selection with member editing disabled', async () => {
    mocks.owner = 2
    const response = await GET(request('GET'))
    expect(await response.json()).toEqual({ accounts: [], canEdit: false })
    expect(mocks.get).toHaveBeenCalledWith(2)
  })
  it('prevents members and example users from changing account selection', async () => {
    mocks.owner = 2
    expect((await PUT(request('PUT', { accountIds: [1] }))).status).toBe(403)
    mocks.owner = 1
    mocks.auth.isExample = true
    expect((await PUT(request('PUT', { accountIds: [1] }))).status).toBe(403)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it.each([null, {}, { accountIds: 'all' }, { accountIds: [1, 1] }, { accountIds: [-1] }, { accountIds: ['1'] }])('rejects malformed selections %j', async body => {
    expect((await PUT(request('PUT', body))).status).toBe(400)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('accepts zero selected accounts and scopes the save to the owner', async () => {
    expect((await PUT(request('PUT', { accountIds: [] }))).status).toBe(200)
    expect(mocks.save).toHaveBeenCalledWith(1, [])
  })
  it('rejects stale or foreign account ids', async () => {
    mocks.save.mockResolvedValue(false)
    expect((await PUT(request('PUT', { accountIds: [999] }))).status).toBe(400)
  })
})
