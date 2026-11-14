import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ banks: vi.fn(), cards: vi.fn(), prepare: vi.fn(), owner: vi.fn() }))
vi.mock('@/lib/budget-db', () => ({ getBankAccounts: mocks.banks, getCreditCards: mocks.cards }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ prepare: mocks.prepare }) }))
vi.mock('@/lib/household-db', () => ({ resolveBudgetUserId: mocks.owner }))
import { getHomeAffordabilityData, monthlyBill, payPeriodsPerYear } from '@/lib/home-affordability-data'
const calls: unknown[][] = []
beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  mocks.owner.mockResolvedValue(99)
  mocks.banks.mockResolvedValue([
    { id: 1, name: 'PennyMac', account_type: 'loan', loan_kind: 'mortgage', current_balance: 221897.84, interest_rate: 3.125, monthly_payment: 1776.46, is_active: 1, liens: [{ name: 'HUD', amount: 20441.75 }] },
    { id: 2, name: 'Auto Loan', institution: 'Bridgecrest', account_type: 'loan', current_balance: 9000, monthly_payment: 200, is_active: 1 },
    { id: 3, name: 'Capital One', account_type: 'loan', current_balance: 10000, monthly_payment: null, is_active: 1 },
    { id: 4, name: 'WoodStock', account_type: 'loan', current_balance: 0, monthly_payment: 50, is_active: 1 },
  ])
  mocks.cards.mockResolvedValue([{ id: 10, name: 'Capital One', current_balance: 1000, is_active: 1 }])
  mocks.prepare.mockImplementation((query: string) => ({
    all: async (...args: unknown[]) => {
      calls.push([query, ...args])
      if (query.includes('budget_paychecks')) return [{ employee_name: 'Richard', gross_pay: 2000, net_pay: 1500, pay_period_begin: '2026-10-01', pay_period_end: '2026-10-14' }]
      return [
        { id: 20, payee_name: 'PennyMac', amount: 1776.46, is_recurring: 1, recurrence_type: 'monthly' },
        { id: 21, payee_name: 'Capital One', credit_card_id: 10, amount: 100, is_recurring: 1, recurrence_type: 'monthly' },
        { id: 22, payee_name: 'Bridgecrest - Sorento', amount: 200, is_recurring: 1, recurrence_type: 'monthly' },
        { id: 24, payee_name: 'CapitalOne Auto Loan', amount: 373, is_recurring: 1, recurrence_type: 'monthly' },
        { id: 25, payee_name: 'Nelnet - Ella', amount: 100, is_recurring: 1, recurrence_type: 'monthly' },
        { id: 26, payee_name: 'Brookside HOA Fees', amount: 400, is_recurring: 1, recurrence_type: 'annual' },
        { id: 23, payee_name: 'Power', amount: 125, is_recurring: 1, recurrence_type: 'monthly', category_name: 'Utilities' },
      ]
    },
    get: async (...args: unknown[]) => {
      calls.push([query, ...args])
      if (query.includes('budget_affordability_preferences')) return { settings: { monthlyGrossIncome: 10045, salePrice: 340000, downPaymentPercent: 3, currentLocation: 'Dallas, GA' } }
      return { total: -20 }
    },
  }))
})
describe('home affordability data sources', () => {
  it('resolves shared household ownership and scopes all financial reads', async () => {
    await getHomeAffordabilityData(7)
    expect(mocks.owner).toHaveBeenCalledWith(7)
    expect(mocks.banks).toHaveBeenCalledWith(99)
    expect(mocks.cards).toHaveBeenCalledWith(99)
    expect(calls.every(call => call[1] === 99)).toBe(true)
  })
  it('uses the current full housing payment and avoids duplicate housing / debt expenses', async () => {
    const data = await getHomeAffordabilityData(7)
    expect(data.mortgages[0].payment).toBe(1776.46)
    expect(data.debts.some(debt => debt.label === 'PennyMac')).toBe(false)
    expect(data.debts.some(debt => debt.label === 'WoodStock')).toBe(false)
    expect(data.expenses.map(expense => expense.label)).toEqual(['Power'])
    expect(data.debts.find(debt => debt.id === 'loan-2')?.payment).toBe(200)
    expect(data.debts.find(debt => debt.label === 'Nelnet - Ella')?.payment).toBe(100)
    expect(data.assumptions.currentMonthlyHOA).toBe(33.33)
  })
  it('matches the auto-loan bill without consuming a same-name linked card bill', async () => {
    const data = await getHomeAffordabilityData(7)
    expect(data.debts.find(debt => debt.id === 'loan-3')?.payment).toBe(373)
    expect(data.debts.find(debt => debt.id === 'card-10')?.payment).toBe(100)
  })
  it('keeps the confirmed gross income, derives take-home with 26 biweekly checks, and preserves negative cash', async () => {
    const data = await getHomeAffordabilityData(7)
    expect(data.assumptions.monthlyGrossIncome).toBe(10045)
    expect(data.assumptions.monthlyNetIncome).toBe(3250)
    expect(data.assumptions.cashOnHand).toBe(-20)
    expect(data.assumptions.salePrice).toBe(340000)
    expect(calls.find(call => String(call[0]).includes('AS total'))?.[0]).toContain('include_in_available=1')
  })
  it('normalizes recurring obligations and does not confuse biweekly with semimonthly', () => {
    expect(payPeriodsPerYear('2026-10-01', '2026-10-14')).toBe(26)
    expect(payPeriodsPerYear('2026-10-01', '2026-10-15')).toBe(24)
    expect(payPeriodsPerYear('2026-10-01', '2026-10-07')).toBe(52)
    expect(payPeriodsPerYear('2026-10-01', '2026-10-31')).toBe(12)
    expect(monthlyBill(1200, 'annual')).toBe(100)
    expect(monthlyBill(100, 'weekly')).toBeCloseTo(433.3333)
  })
})
