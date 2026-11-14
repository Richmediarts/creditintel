import { describe, expect, it } from 'vitest'
import { HOME_DEFAULTS, buildHomePlan, housingCost, mortgagePayment, purchaseScenario, saleProceeds, validateHomePlan, type HomePlanInput } from '@/lib/utils/home-affordability'
function sample(): HomePlanInput {
  return {
    assumptions: { ...HOME_DEFAULTS, salePrice: 350000, monthlyGrossIncome: 12000, monthlyNetIncome: 9000,
      cashOnHand: 20000, currentLienMonthlyPayment: 0 },
    mortgage: { id: 1, name: 'PennyMac', balance: 221897.84, apr: 3.125, payment: 1776.46, principalInterest: 1093.60,
      liens: [{ name: 'HUD FHA partial claim', amount: 20441.75 }, { name: 'Midland judgment (Ella)', amount: 7106.10 }] },
    debts: [{ id: 'auto', label: 'Auto loan', balance: 10000, payment: 300, source: 'Saved', payoff: false }],
    expenses: [{ id: 'living', label: 'Living costs', amount: 1500 }],
  }
}
describe('home sale accounting', () => {
  it('deducts mortgage and both liens exactly once', () => {
    const sale = saleProceeds(sample())!
    expect(sale.totalPayoffs).toBe(249445.69)
    expect(sale.agentCosts).toBe(17500)
    expect(sale.otherCosts).toBe(5250)
    expect(sale.net).toBe(77804.31)
  })
  it('uses an official mortgage-only payoff override without dropping liens', () => {
    const input = sample()
    input.assumptions.mortgagePayoffOverride = 222000
    input.assumptions.payoffExtra = 100
    expect(saleProceeds(input)?.totalPayoffs).toBe(249647.85)
  })
  it('preserves a sale shortfall instead of turning it into zero equity', () => {
    const input = sample()
    input.assumptions.salePrice = 200000
    expect(saleProceeds(input)?.net).toBe(-62445.69)
    const scenario = purchaseScenario(input, 'sell-first')
    expect(scenario.fundsForPurchase).toBeLessThan(0)
    expect(scenario.price).toBe(0)
  })
  it('does not invent a sale price', () => {
    const input = sample()
    input.assumptions.salePrice = null
    expect(saleProceeds(input)).toBeNull()
    expect(purchaseScenario(input, 'sell-first').price).toBeNull()
  })
  it('computes a break-even price that covers the liens and selling costs', () => {
    const input = sample()
    const breakEven = saleProceeds(input)!.breakEvenPrice
    input.assumptions.salePrice = breakEven
    expect(saleProceeds(input)!.net).toBeGreaterThanOrEqual(0)
  })
})
describe('purchase limits and timing', () => {
  it('uses future sale proceeds only when the sale funds before the purchase', () => {
    const input = sample()
    const first = purchaseScenario(input, 'sell-first')
    const buy = purchaseScenario(input, 'buy-first')
    expect(first.startingFunds - buy.startingFunds).toBeCloseTo(saleProceeds(input)!.net, 2)
    expect(first.holdingPayment).toBe(0)
    expect(buy.holdingPayment).toBe(1776.46)
    expect(buy.transitionCosts).toBeCloseTo(1776.46 * 3, 2)
    expect(first.price).toBeGreaterThan(buy.price!)
  })
  it('does not remove the old mortgage from current DTI', () => {
    expect(buildHomePlan(sample()).currentDti).toBeCloseTo((1776.46 + 300) / 12000 * 100)
  })
  it('blocks buy-first if pre-sale lien payments are unknown', () => {
    const input = sample()
    input.assumptions.currentLienMonthlyPayment = null
    expect(purchaseScenario(input, 'buy-first').price).toBeNull()
    expect(purchaseScenario(input, 'sell-first').price).not.toBeNull()
    expect(buildHomePlan(input).currentDti).toBeNull()
  })
  it('subtracts temporary housing and moving costs from sale cash', () => {
    const input = sample()
    input.assumptions.temporaryHousingCosts = 4000
    input.assumptions.movingCosts = 2000
    expect(purchaseScenario(input, 'sell-first').transitionCosts).toBe(6000)
    expect(purchaseScenario(input, 'coordinated').transitionCosts).toBe(2000)
  })
  it('requires both cash-to-close and monthly budget feasibility', () => {
    const input = sample()
    input.assumptions.cashOnHand = 0
    input.assumptions.salePrice = 290000
    const scenario = purchaseScenario(input, 'sell-first')
    expect(scenario.cashLimit).toBeLessThan(scenario.incomeLimit!)
    expect(scenario.price).toBe(scenario.cashLimit)
    expect(scenario.purchase!.total).toBeLessThanOrEqual(scenario.fundsForPurchase + .01)
  })
  it('retains months of actual outgoings as reserves, not a dollar count of months', () => {
    const input = sample()
    const scenario = purchaseScenario(input, 'sell-first')
    expect(scenario.purchase!.reserve).toBeCloseTo(3 * (scenario.purchase!.housing.total + 300 + 1500))
  })
  it('includes ordinary bills in cash flow but not lender DTI', () => {
    const input = sample()
    const original = purchaseScenario(input, 'sell-first')
    input.expenses[0].amount = 7000
    const tight = purchaseScenario(input, 'sell-first')
    expect(tight.debtPayments).toBe(original.debtPayments)
    expect(tight.housingBudget).toBeLessThan(original.housingBudget)
    expect(tight.price).toBeLessThan(original.price!)
  })
  it('charges the full balance before removing a selected debt payment', () => {
    const input = sample()
    input.debts[0].payoff = true
    const scenario = purchaseScenario(input, 'sell-first')
    expect(scenario.payoffCash).toBe(10000)
    expect(scenario.debtPayments).toBe(0)
    expect(scenario.fundsForPurchase).toBeCloseTo(scenario.startingFunds - 10000)
  })
  it('never converts partial payoff dollars into a monthly payment reduction', () => {
    const input = sample()
    const original = purchaseScenario(input, 'sell-first')
    input.assumptions.cashOnHand -= 500
    const modified = purchaseScenario(input, 'sell-first')
    expect(modified.debtPayments).toBe(original.debtPayments)
  })
  it('blocks firm estimates for unknown debt payments, living costs or payoff balances', () => {
    const input = sample()
    input.debts[0].payment = null
    expect(purchaseScenario(input, 'sell-first').price).toBeNull()
    input.debts[0].payment = 300
    input.debts[0].payoff = true
    input.debts[0].balance = null
    expect(purchaseScenario(input, 'sell-first').price).toBeNull()
    input.debts[0].payoff = false
    input.expenses[0].amount = null
    expect(purchaseScenario(input, 'sell-first').price).toBeNull()
  })
  it('does not count emergency reserves as down payment cash', () => {
    const input = sample()
    const reserved = purchaseScenario(input, 'sell-first')
    input.assumptions.reserveMonths = 0
    const unreserved = purchaseScenario(input, 'sell-first')
    expect(unreserved.cashLimit).toBeGreaterThan(reserved.cashLimit!)
  })
})
describe('loan math and input boundaries', () => {
  it('computes a zero-interest payment and distinguishes PMI at 20% down', () => {
    expect(mortgagePayment(120000, 0, 10)).toBe(1000)
    expect(housingCost(300000, { ...HOME_DEFAULTS, downPaymentPercent: 20 }).pmi).toBe(0)
    expect(housingCost(300000, { ...HOME_DEFAULTS, downPaymentPercent: 19.99 }).pmi).toBeGreaterThan(0)
  })
  it('rejects malformed input, unbounded fees, invalid term and nonfinite values', () => {
    expect(validateHomePlan(sample())).toBe(true)
    expect(validateHomePlan(null)).toBe(false)
    for (const assumptions of [
      { termYears: 0 }, { targetDtiPercent: 100 }, { interestRate: Infinity },
      { sellerAgentPercent: 100 }, { reserveMonths: -1 }, { salePrice: -1 },
    ]) {
      expect(validateHomePlan({ ...sample(), assumptions: { ...sample().assumptions, ...assumptions } })).toBe(false)
    }
  })
  it('preserves a negative bank snapshot and never adds old escrow as principal', () => {
    const input = sample()
    input.assumptions.cashOnHand = -100
    expect(validateHomePlan(input)).toBe(true)
    expect(saleProceeds(input)!.mortgagePayoff).toBe(221897.84)
  })
})

describe('low down payment comparison', () => {
  it('does not treat zero down as zero cash to close', () => {
    const input = sample()
    input.assumptions.downPaymentPercent = 0
    const scenario = purchaseScenario(input, 'sell-first')
    expect(scenario.purchase!.down).toBe(0)
    expect(scenario.purchase!.closing).toBeGreaterThan(0)
    expect(scenario.purchase!.reserve).toBeGreaterThan(0)
  })
  it('identifies zero and very low down payment cases as conditional', () => {
    const rows = buildHomePlan(sample()).downPaymentComparison
    expect(rows.map(row => row.downPaymentPercent)).toEqual([0, 3, 3.5, 5, 10, 20])
    expect(rows[0].conditional).toBe(true)
  })
  it('shows no purchase when cash cannot cover even baseline reserves', () => {
    const input = sample()
    input.assumptions.salePrice = 270000
    input.assumptions.cashOnHand = 0
    const scenario = purchaseScenario(input, 'sell-first')
    expect(scenario.price).toBe(0)
    expect(scenario.purchase).toBeNull()
  })
})

describe('sale-funded debt payoff allocation comparison', () => {
  it('keeps payoff cash and reserves in the calculation and can free monthly capacity', () => {
    const input = sample()
    input.debts = [{ id: 'small-auto', label: 'Small auto loan', balance: 1000, payment: 1000, source: 'Saved', payoff: false }]
    const plan = buildHomePlan(input)
    const candidate = plan.payoffComparisons.find(option => option.ids.includes('small-auto'))!
    expect(candidate.scenario.payoffCash).toBe(1000)
    expect(candidate.monthlyPaymentFreed).toBe(1000)
    expect(candidate.scenario.debtPayments).toBe(0)
    expect(candidate.scenario.purchase!.total).toBeLessThanOrEqual(candidate.scenario.fundsForPurchase + .01)
  })
  it('does not automatically pay off debts whose balances are unknown', () => {
    const input = sample()
    input.debts[0].balance = null
    expect(buildHomePlan(input).payoffComparisons.every(option => !option.ids.includes('auto'))).toBe(true)
  })
  it('retains old HOA in buy-first housing costs without charging it after sale', () => {
    const input = sample()
    input.assumptions.currentMonthlyHOA = 40
    expect(purchaseScenario(input, 'buy-first').holdingPayment).toBe(1816.46)
    expect(purchaseScenario(input, 'sell-first').holdingPayment).toBe(0)
  })
})

describe('bounded payoff comparison coverage', () => {
  it('compares paying all known debts even when there are more than twelve accounts', () => {
    const input = sample()
    input.assumptions.cashOnHand = 1000000
    input.debts = Array.from({ length: 14 }, (_, index) => ({ id: 'debt-' + index, label: 'Card ' + index, balance: 100, payment: 20, source: 'Saved', payoff: false }))
    const best = buildHomePlan(input).payoffComparisons[0]
    expect(best.ids).toHaveLength(14)
    expect(best.scenario.payoffCash).toBe(1400)
    expect(best.scenario.debtPayments).toBe(0)
  })
})
