import { sumLiens, type MortgageLien } from './liability'

export interface HomeMortgage {
  id: number; name: string; balance: number; apr: number | null; payment: number | null
  principalInterest: number | null; liens: MortgageLien[]
}
export interface HomeDebt {
  id: string; label: string; balance: number | null; payment: number | null
  source: string; payoff: boolean
}
export interface HomeExpense { id: string; label: string; amount: number | null }
export interface HomeAssumptions {
  salePrice: number | null
  sellerAgentPercent: number
  sellerOtherPercent: number
  repairsAndCredits: number
  payoffExtra: number
  mortgagePayoffOverride: number | null
  monthlyGrossIncome: number
  monthlyNetIncome: number
  cashOnHand: number
  extraCash: number
  downPaymentPercent: number
  interestRate: number
  termYears: number
  propertyTaxRate: number
  annualInsurance: number
  monthlyHOA: number
  annualPmiPercent: number
  buyerClosingPercent: number
  reserveMonths: number
  monthlyCashBuffer: number
  movingCosts: number
  temporaryHousingCosts: number
  overlapMonths: number
  targetDtiPercent: number
  currentMonthlyHOA: number
  currentLienMonthlyPayment: number | null
}
export interface HomePlanInput {
  assumptions: HomeAssumptions
  mortgage: HomeMortgage | null
  debts: HomeDebt[]
  expenses: HomeExpense[]
}
export const HOME_DEFAULTS: HomeAssumptions = {
  salePrice: null, sellerAgentPercent: 5, sellerOtherPercent: 1.5, repairsAndCredits: 0,
  payoffExtra: 0, mortgagePayoffOverride: null,
  monthlyGrossIncome: 0, monthlyNetIncome: 0, cashOnHand: 0, extraCash: 0,
  downPaymentPercent: 20, interestRate: 7.11, termYears: 30,
  propertyTaxRate: 1, annualInsurance: 1800, monthlyHOA: 0, annualPmiPercent: 0.5,
  buyerClosingPercent: 3, reserveMonths: 3, monthlyCashBuffer: 500,
  movingCosts: 0, temporaryHousingCosts: 0, overlapMonths: 3, targetDtiPercent: 36, currentMonthlyHOA: 0, currentLienMonthlyPayment: null,
}
const cents = (value: number) => Math.round(value * 100) / 100
export function mortgagePayment(principal: number, rate: number, years: number): number {
  if (principal <= 0) return 0
  const months = years * 12
  const monthlyRate = rate / 1200
  return monthlyRate === 0 ? principal / months : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months))
}
export function housingCost(price: number, a: HomeAssumptions) {
  const loan = price * (1 - a.downPaymentPercent / 100)
  const principalInterest = mortgagePayment(loan, a.interestRate, a.termYears)
  const tax = price * a.propertyTaxRate / 1200
  const insurance = price > 0 ? a.annualInsurance / 12 : 0
  const hoa = price > 0 ? a.monthlyHOA : 0
  const pmi = price > 0 && a.downPaymentPercent < 20 ? loan * a.annualPmiPercent / 1200 : 0
  return { loan, principalInterest, tax, insurance, hoa, pmi, total: principalInterest + tax + insurance + hoa + pmi }
}
export function saleProceeds(input: HomePlanInput) {
  const a = input.assumptions
  if (!input.mortgage || a.salePrice == null) return null
  const mortgagePayoff = a.mortgagePayoffOverride ?? input.mortgage.balance
  const liens = sumLiens(input.mortgage.liens)
  const agentCosts = a.salePrice * a.sellerAgentPercent / 100
  const otherCosts = a.salePrice * a.sellerOtherPercent / 100
  const totalPayoffs = mortgagePayoff + liens + a.payoffExtra
  const net = a.salePrice - agentCosts - otherCosts - a.repairsAndCredits - totalPayoffs
  const retained = 1 - (a.sellerAgentPercent + a.sellerOtherPercent) / 100
  return {
    price: a.salePrice, mortgagePayoff, liens, agentCosts: cents(agentCosts),
    otherCosts: cents(otherCosts), totalPayoffs: cents(totalPayoffs), net: cents(net),
    breakEvenPrice: Math.ceil((totalPayoffs + a.repairsAndCredits) / retained),
  }
}
export type PurchaseTiming = 'sell-first' | 'coordinated' | 'buy-first'
export const TIMING_LABELS: Record<PurchaseTiming, string> = {
  'sell-first': 'Sell first, then buy', coordinated: 'Coordinated closings', 'buy-first': 'Buy before selling',
}
export function purchaseScenario(input: HomePlanInput, timing: PurchaseTiming, dti = input.assumptions.targetDtiPercent) {
  const a = input.assumptions
  const sale = saleProceeds(input)
  const retainedDebts = input.debts.filter(debt => !debt.payoff)
  const debtPayments = retainedDebts.reduce((sum, debt) => sum + (debt.payment ?? 0), 0)
  const livingExpenses = input.expenses.reduce((sum, expense) => sum + (expense.amount ?? 0), 0)
  const payoffCash = input.debts.filter(debt => debt.payoff).reduce((sum, debt) => sum + (debt.balance ?? 0), 0)
  const holdingPayment = timing === 'buy-first' ? (input.mortgage?.payment ?? 0) + a.currentMonthlyHOA + (a.currentLienMonthlyPayment ?? 0) : 0
  const startingFunds = a.cashOnHand + a.extraCash + (timing === 'buy-first' ? 0 : sale?.net ?? 0)
  const transitionCosts = a.movingCosts + (timing === 'sell-first' ? a.temporaryHousingCosts : timing === 'buy-first' ? holdingPayment * a.overlapMonths : 0)
  const fundsForPurchase = startingFunds - payoffCash - transitionCosts
  const debtBudget = a.monthlyGrossIncome * dti / 100 - debtPayments - holdingPayment
  const netBudget = a.monthlyNetIncome - debtPayments - holdingPayment - livingExpenses - a.monthlyCashBuffer
  const housingBudget = Math.max(0, Math.min(debtBudget, netBudget))
  const missing: string[] = []
  if (!input.mortgage) missing.push('Choose the mortgage you plan to sell.')
  if (timing !== 'buy-first' && !sale) missing.push('Enter the expected home sale price.')
  if (a.monthlyGrossIncome <= 0) missing.push('Enter verified gross monthly household income.')
  if (a.monthlyNetIncome <= 0) missing.push('Enter take-home monthly household income.')
  if (retainedDebts.some(debt => debt.payment == null)) missing.push('Enter the missing monthly debt payments.')
  if (input.debts.some(debt => debt.payoff && debt.balance == null)) missing.push('Enter balances for debts selected for full payoff.')
  if (input.expenses.some(expense => expense.amount == null)) missing.push('Enter the missing recurring living expenses.')
  if (timing === 'buy-first' && input.mortgage?.payment == null) missing.push('Enter the current full mortgage payment.')
  if (timing === 'buy-first' && input.mortgage?.liens.length && a.currentLienMonthlyPayment == null) missing.push('Confirm monthly payments on attached liens before selling; enter zero only if no payments are required.')
  const cashRequired = (price: number) => {
    const housing = housingCost(price, a)
    const down = price * a.downPaymentPercent / 100
    const closing = price * a.buyerClosingPercent / 100
    const reserve = a.reserveMonths * (housing.total + debtPayments + livingExpenses + holdingPayment)
    return { down, closing, reserve, total: down + closing + reserve, housing }
  }
  const search = (predicate: (price: number) => boolean) => {
    if (!predicate(0)) return 0
    let lo = 0, hi = 20_000_000
    for (let n = 0; n < 75; n++) {
      const mid = (lo + hi) / 2
      if (predicate(mid)) lo = mid
      else hi = mid
    }
    return Math.floor(lo)
  }
  const ready = missing.length === 0
  const incomeLimit = ready ? search(price => housingCost(price, a).total <= housingBudget) : null
  const cashLimit = ready ? search(price => cashRequired(price).total <= fundsForPurchase) : null
  const price = ready ? Math.min(incomeLimit!, cashLimit!) : null
  const purchase = price == null || price <= 0 ? null : cashRequired(price)
  const actualDti = purchase && a.monthlyGrossIncome > 0 ? (purchase.housing.total + debtPayments + holdingPayment) / a.monthlyGrossIncome * 100 : null
  const surplus = purchase ? a.monthlyNetIncome - purchase.housing.total - debtPayments - holdingPayment - livingExpenses : null
  return {
    timing, label: TIMING_LABELS[timing], dtiTarget: dti, missing, ready, price,
    incomeLimit, cashLimit, bindingLimit: price == null ? null : incomeLimit! <= cashLimit! ? 'Monthly budget / DTI' : 'Cash for closing / reserves',
    debtPayments: cents(debtPayments), livingExpenses: cents(livingExpenses), holdingPayment,
    startingFunds: cents(startingFunds), transitionCosts: cents(transitionCosts), payoffCash: cents(payoffCash),
    fundsForPurchase: cents(fundsForPurchase), housingBudget: cents(housingBudget),
    purchase, actualDti, monthlySurplus: surplus,
    cashRemaining: purchase ? cents(fundsForPurchase - purchase.down - purchase.closing) : null,
  }
}
/** Compares bounded, transparent payoff candidates; this is not a global financial optimum. */
export function compareDebtAllocations(input: HomePlanInput) {
  const eligible = input.debts.filter(debt => debt.balance != null && debt.balance > 0 && debt.payment != null && debt.payment > 0 && !debt.id.startsWith('other-mortgage-'))
  const candidates = new Map<string, string[]>()
  const add = (ids: string[]) => {
    const normalized = [...ids].sort()
    candidates.set(normalized.join('|'), normalized)
  }
  add([])
  add(eligible.map(debt => debt.id))
  add(input.debts.filter(debt => debt.payoff).map(debt => debt.id))
  const efficient = eligible.slice().sort((a, b) => b.payment! / b.balance! - a.payment! / a.balance!)
  efficient.slice(0, 12).forEach(debt => add([debt.id]))
  for (const ranked of [efficient, eligible.slice().sort((a, b) => a.balance! - b.balance!), eligible.slice().sort((a, b) => b.payment! - a.payment!)]) {
    const ids: string[] = []
    for (const debt of ranked.slice(0, 12)) { ids.push(debt.id); add([...ids]) }
  }
  return [...candidates.values()].map(ids => {
    const debts = input.debts.map(debt => ({ ...debt, payoff: ids.includes(debt.id) }))
    const scenario = purchaseScenario({ ...input, debts }, 'sell-first')
    return {
      ids, labels: debts.filter(debt => debt.payoff).map(debt => debt.label),
      monthlyPaymentFreed: cents(debts.filter(debt => debt.payoff).reduce((sum, debt) => sum + (debt.payment ?? 0), 0)),
      scenario,
    }
  }).sort((a, b) => (b.scenario.price ?? -1) - (a.scenario.price ?? -1) || a.scenario.payoffCash - b.scenario.payoffCash).slice(0, 3)
}
export function buildHomePlan(input: HomePlanInput) {
  const sale = saleProceeds(input)
  return {
    sale,
    payoffComparisons: compareDebtAllocations(input),
    currentDti: input.assumptions.monthlyGrossIncome > 0 && input.mortgage?.payment != null && input.debts.every(debt => debt.payment != null) && (!input.mortgage.liens.length || input.assumptions.currentLienMonthlyPayment != null)
      ? (input.mortgage.payment + input.assumptions.currentMonthlyHOA + (input.assumptions.currentLienMonthlyPayment ?? 0) + input.debts.reduce((sum, debt) => sum + debt.payment!, 0)) / input.assumptions.monthlyGrossIncome * 100 : null,
    scenarios: (['sell-first', 'coordinated', 'buy-first'] as const).map(timing => purchaseScenario(input, timing)),
    dtiComparison: [36, 43, 45, 50].map(ratio => purchaseScenario(input, 'sell-first', ratio)),
    downPaymentComparison: [0, 3, 3.5, 5, 10, 20].map(down => ({ downPaymentPercent: down, conditional: down < 5, scenario: purchaseScenario({ ...input, assumptions: { ...input.assumptions, downPaymentPercent: down } }, 'sell-first') })),
    sensitivity: input.assumptions.salePrice == null ? [] : [0.95, 1, 1.05].map(multiplier => {
      const adjusted = { ...input, assumptions: { ...input.assumptions, salePrice: Math.round(input.assumptions.salePrice! * multiplier) } }
      return { sale: saleProceeds(adjusted), scenario: purchaseScenario(adjusted, 'sell-first') }
    }),
  }
}
export function validateHomePlan(value: unknown): value is HomePlanInput {
  if (!value || typeof value !== 'object') return false
  const input = value as HomePlanInput
  const a = input.assumptions
  if (!a || typeof a !== 'object') return false
  for (const key of Object.keys(HOME_DEFAULTS) as (keyof HomeAssumptions)[]) {
    const number = a[key]
    if (number === null && ['salePrice', 'mortgagePayoffOverride', 'currentLienMonthlyPayment'].includes(key)) continue
    if (typeof number !== 'number' || !Number.isFinite(number) || Math.abs(number) > 1e10 || (number < 0 && key !== 'cashOnHand')) return false
  }
  if (a.downPaymentPercent > 100 || a.targetDtiPercent <= 0 || a.targetDtiPercent > 50 ||
    a.sellerAgentPercent + a.sellerOtherPercent >= 100 || a.termYears < 1 || a.termYears > 50 ||
    a.interestRate > 30 || a.propertyTaxRate > 20 || a.annualPmiPercent > 10 ||
    a.buyerClosingPercent > 30 || a.reserveMonths > 24 || a.overlapMonths > 24) return false
  const nonnegative = (number: unknown) => typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 1e10
  const nullableMoney = (number: unknown) => number === null || nonnegative(number)
  const label = (text: unknown) => typeof text === 'string' && text.trim().length > 0 && text.length <= 250
  if (input.mortgage !== null) {
    const mortgage = input.mortgage
    if (!mortgage || !label(mortgage.name) || !nonnegative(mortgage.balance) || !nullableMoney(mortgage.payment) ||
      !nullableMoney(mortgage.apr) || !nullableMoney(mortgage.principalInterest) || !Array.isArray(mortgage.liens) || mortgage.liens.length > 30 ||
      mortgage.liens.some(lien => !lien || !label(lien.name) || !nonnegative(lien.amount))) return false
  }
  return Array.isArray(input.debts) && input.debts.length <= 200 && input.debts.every(debt =>
    debt && label(debt.id) && label(debt.label) && nullableMoney(debt.balance) && nullableMoney(debt.payment) && typeof debt.payoff === 'boolean') &&
    Array.isArray(input.expenses) && input.expenses.length <= 200 && input.expenses.every(expense =>
      expense && label(expense.id) && label(expense.label) && nullableMoney(expense.amount))
}
