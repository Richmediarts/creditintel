import { describe, expect, it } from 'vitest'
import { estimateLiability, validateLiabilityTerms, sumLiens } from '@/lib/utils/liability'

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

describe('mortgage and linked lien accounting', () => {
  const liens = [
    { name: 'HUD FHA partial claim', amount: 20441.75 },
    { name: 'Midland judgment (Ella)', amount: 7106.10 },
  ]
  it('totals the attached liens once, separately from the mortgage balance', () => {
    expect(sumLiens(liens)).toBe(27547.85)
    expect(221897.84 + sumLiens(liens)).toBe(249445.69)
    expect(sumLiens()).toBe(0)
  })
  it('accepts mortgage terms with a separate principal-and-interest payment', () => {
    expect(validateLiabilityTerms({ account_type: 'loan', loan_kind: 'mortgage', current_balance: 221897.84,
      interest_rate: 3.125, monthly_payment: 1776.46, principal_interest_payment: 1093.60, liens })).toBeNull()
  })
  it('rejects duplicated liens instead of double-counting', () => {
    expect(validateLiabilityTerms({ account_type: 'loan', loan_kind: 'mortgage', current_balance: 100,
      liens: [{ name: 'HUD', amount: 10 }, { name: ' hud ', amount: 10 }] })).toBeTruthy()
  })
  it.each([
    { name: '', amount: 10 }, { name: 'HUD', amount: null }, { name: 'HUD', amount: -10 },
  ])('does not treat missing lien amounts as zero', lien => {
    expect(validateLiabilityTerms({ account_type: 'loan', loan_kind: 'mortgage', current_balance: 100, liens: [lien] })).toBeTruthy()
  })
  it('prevents liens from being attached to cash or other loan accounts', () => {
    expect(validateLiabilityTerms({ account_type: 'checking', loan_kind: 'mortgage', liens })).toBeTruthy()
    expect(validateLiabilityTerms({ account_type: 'loan', loan_kind: 'auto', current_balance: 100, liens })).toBeTruthy()
  })
  it('rejects principal and interest greater than the full payment', () => {
    expect(validateLiabilityTerms({ monthly_payment: 100, principal_interest_payment: 101 })).toBeTruthy()
  })
  it('does not use unknown or escrow-inclusive payments to claim a mortgage payoff', () => {
    expect(estimateLiability(221897.84, 3.125, null).payoffMonths).toBeNull()
    const pi = estimateLiability(221897.84, 3.125, 1093.60)
    const total = estimateLiability(221897.84, 3.125, 1776.46)
    expect(pi.payoffMonths).toBeGreaterThan(total.payoffMonths!)
  })
})
