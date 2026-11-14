import { describe, expect, it } from 'vitest'
import { estimateLiability, validateLiabilityTerms } from '@/lib/utils/liability'

describe('liability interest estimates', () => {
  it('keeps an unknown APR distinct from zero interest', () => {
    expect(estimateLiability(1000, null, 100)).toMatchObject({ status: 'unknown_rate', monthlyInterest: null, totalRemaining: null })
    expect(estimateLiability(1000, 0, 300)).toMatchObject({ status: 'estimated', payoffMonths: 4, futureInterest: 0, totalRemaining: 1000 })
  })
  it('includes monthly interest and caps the final payment at what is owed', () => {
    expect(estimateLiability(1000, 12, 2000)).toMatchObject({
      monthlyInterest: 10, principalNextPayment: 1000, payoffMonths: 1, futureInterest: 10, totalRemaining: 1010,
    })
  })
  it('amortizes a multi-month loan with cent rounding', () => {
    const result = estimateLiability(1000, 12, 100)
    expect(result.payoffMonths).toBe(11)
    expect(result.monthlyInterest).toBe(10)
    expect(result.principalNextPayment).toBe(90)
    expect(result.futureInterest).toBeGreaterThan(58)
    expect(result.futureInterest).toBeLessThan(60)
    expect(result.totalRemaining).toBe(1000 + result.futureInterest!)
  })
  it('does not invent a payoff without a payment', () => {
    expect(estimateLiability(1000, 12, null)).toMatchObject({ status: 'payment_needed', monthlyInterest: 10, payoffMonths: null })
  })
  it('warns when payments do not cover interest', () => {
    expect(estimateLiability(1000, 12, 10)).toMatchObject({ status: 'non_amortizing', totalRemaining: null, payoffMonths: null })
    expect(estimateLiability(1000, 12, 5).status).toBe('non_amortizing')
  })
  it('handles a paid-off balance even if terms are unknown', () => {
    expect(estimateLiability(0, null, null)).toMatchObject({ status: 'paid_off', totalRemaining: 0, futureInterest: 0 })
  })
  it('bounds projections for tiny payments', () => {
    expect(estimateLiability(1000000, 0, 0.01).status).toBe('beyond_horizon')
  })
})
describe('liability input validation', () => {
  it('accepts known zero interest and explicitly unknown terms', () => {
    expect(validateLiabilityTerms({ account_type: 'loan', loan_kind: 'settlement', current_balance: 1000, interest_rate: 0, monthly_payment: null })).toBeNull()
    expect(validateLiabilityTerms({ account_type: 'loan', current_balance: 1000, interest_rate: null })).toBeNull()
  })
  it.each([
    { interest_rate: -1 }, { interest_rate: '12' }, { monthly_payment: -1 },
    { monthly_payment: Infinity }, { loan_kind: 'asset' },
    { account_type: 'loan', current_balance: -1 }, { account_type: 'loan' },
  ])('rejects invalid loan terms %j', input => {
    expect(validateLiabilityTerms(input)).toBeTruthy()
  })
})
