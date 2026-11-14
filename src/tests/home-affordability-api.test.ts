import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { HOME_DEFAULTS } from '@/lib/utils/home-affordability'
const mocks = vi.hoisted(() => ({ auth: { userId: 7 }, data: vi.fn() }))
vi.mock('@/lib/auth', () => ({ verifyToken: () => mocks.auth }))
vi.mock('@/lib/home-affordability-data', () => ({ getHomeAffordabilityData: mocks.data }))
import { GET, POST } from '@/app/api/budget/affordability/route'
const request = (method: string, body?: unknown, authenticated = true) => new NextRequest('http://localhost/api/budget/affordability', {
  method, headers: { 'content-type': 'application/json', ...(authenticated ? { cookie: 'credit-dashboard-token=test' } : {}) },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
})
beforeEach(() => { vi.clearAllMocks(); mocks.data.mockResolvedValue({ mortgages: [] }) })
describe('home affordability API access', () => {
  it('requires authentication for financial reads and calculations', async () => {
    expect((await GET(request('GET', undefined, false))).status).toBe(401)
    expect((await POST(request('POST', {}, false))).status).toBe(401)
    expect(mocks.data).not.toHaveBeenCalled()
  })
  it('loads household data using the authenticated identity rather than a request user id', async () => {
    expect((await GET(request('GET'))).status).toBe(200)
    expect(mocks.data).toHaveBeenCalledWith(7)
  })
  it('rejects malformed calculation inputs with 400', async () => {
    expect((await POST(request('POST', {}))).status).toBe(400)
    expect((await POST(new NextRequest('http://localhost/api/budget/affordability', { method: 'POST', headers: { cookie: 'credit-dashboard-token=test' }, body: '{bad' }))).status).toBe(400)
  })
  it('returns missing inputs instead of inventing mortgage or income values', async () => {
    const response = await POST(request('POST', { assumptions: HOME_DEFAULTS, mortgage: null, debts: [], expenses: [] }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.result.scenarios[0].price).toBeNull()
    expect(body.result.scenarios[0].missing.length).toBeGreaterThan(0)
  })
  it('returns a genuine loading error rather than an empty debt list on database failure', async () => {
    mocks.data.mockRejectedValue(new Error('Database unavailable'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await GET(request('GET'))
    expect(response.status).toBe(500)
    expect(await response.json()).not.toHaveProperty('data')
    log.mockRestore()
  })
})
