import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

export interface AffordabilityInputs {
  monthlyGrossIncome: number
  monthlyOtherIncome: number
  existingMonthlyDebts: Array<{ label: string; payment: number }>
  recurringMonthlyExpenses: Array<{ label: string; amount: number }>
  downPaymentPercent: number
  interestRate: number
  termYears: number
  propertyTaxRate: number
  annualHomeInsurance: number
  monthlyHOA: number
  miOrMcl: number
  closingCostsPercent: number
  cashOnHand: number
  reservesMonths: number
}

export interface AffordabilityResult {
  grossMonthlyIncome: number
  totalMonthlyIncome: number
  totalRecurringExpenses: number
  totalMonthlyDebtPayments: number
  monthlyHousingBudget43: number
  monthlyHousingBudget45: number
  monthlyHousingBudget50: number
  maxAffordableHousing: number
  maxAffordableHomePrice: number
  estimatedLoanAmount: number
  monthlyPrincipalInterest: number
  monthlyTaxes: number
  monthlyInsurance: number
  mortgageInsurance: number
  totalMonthlyPayment: number
  backEndDTI: number
  frontEndDTI: number
  currentDTI: number
  estimatedCashNeeded: number
  shortOfCashBy: number
  notes: string[]
}

function monthlyPayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0
  const r = annualRate / 100 / 12
  const n = years * 12
  if (r === 0) return principal / n
  return (principal * r) / (1 - Math.pow(1 + r, -n))
}

function computeAffordability(input: AffordabilityInputs): AffordabilityResult {
  const grossMonthlyIncome = Number(input.monthlyGrossIncome) || 0
  const monthlyOtherIncome = Number(input.monthlyOtherIncome) || 0
  const totalMonthlyIncome = grossMonthlyIncome + monthlyOtherIncome

  const totalRecurringExpenses = (input.recurringMonthlyExpenses || []).reduce(
    (sum, e) => sum + (Number(e.amount) || 0), 0
  )
  const totalMonthlyDebtPayments = (input.existingMonthlyDebts || []).reduce(
    (sum, d) => sum + (Number(d.payment) || 0), 0
  )

  const housingCap43 = totalMonthlyIncome * 0.43
  const housingCap45 = totalMonthlyIncome * 0.45
  const housingCap50 = totalMonthlyIncome * 0.5

  const existingDebt = totalMonthlyDebtPayments

  // Binary-search the max home price that keeps total housing under the 45% cap.
  const dp = Math.min(Math.max(input.downPaymentPercent, 0), 100) / 100
  const rate = input.interestRate
  const years = input.termYears || 30
  const taxRate = (input.propertyTaxRate || 0) / 100
  const ins = (input.annualHomeInsurance || 0) / 12
  const hoa = input.monthlyHOA || 0
  const reserves = input.reservesMonths || 0
  const cap = housingCap45

  let price = 0
  let best = {
    price: 0, loan: 0, pi: 0, tax: 0, mortgageInsurance: 0, total: 0,
  }

  if (cap > existingDebt) {
    let lo = 0
    let hi = 5_000_000
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2
      const loan = mid * (1 - dp)
      const pi = monthlyPayment(loan, rate, years)
      const tax = (mid * taxRate) / 12
      const mbi = dp < 0.8 ? ((loan * 0.005) / 12) : 0
      const total = pi + tax + ins + hoa + mbi
      if (total + existingDebt <= cap) {
        lo = mid
        best = { price: mid, loan, pi, tax, mortgageInsurance: mbi, total }
      } else {
        hi = mid
      }
    }
    price = best.price
  }

  const mortgageInsurance = price > 0 && (best.loan / price) < 0.8 ? ((best.loan * 0.005) / 12) : 0
  const totalMonthlyPayment = best.total
  const totalHousingCost = totalMonthlyPayment + existingDebt

  const dti = totalMonthlyIncome > 0 ? (totalHousingCost / totalMonthlyIncome) * 100 : 0
  const currentDti = totalMonthlyIncome > 0 ? ((existingDebt + totalRecurringExpenses) / totalMonthlyIncome) * 100 : 0

  const closingCosts = price * ((input.closingCostsPercent || 0) / 100)
  const downPaymentAmount = price * dp
  const estimatedCashNeeded = downPaymentAmount + closingCosts + reserves
  const shortOfCashBy = estimatedCashNeeded - (input.cashOnHand || 0)

  const notes: string[] = []
  if (dti > 50) notes.push('DTI exceeds 50%. Most lenders will decline this loan amount.')
  else if (dti > 45) notes.push('DTI is above 45%. You may be declined without a strong compensating factor.')
  else if (dti > 43) notes.push('DTI is in the 43-45% range. Acceptable for strong credit, but tight.')
  else notes.push('DTI is comfortably within lender guidelines (<43%).')

  if (shortOfCashBy > 0) {
    notes.push(`You are $${Math.round(shortOfCashBy).toLocaleString()} short of the estimated cash needed for down payment, closing costs, and reserves.`)
  } else {
    notes.push(`You have about $${Math.round(Math.abs(shortOfCashBy)).toLocaleString()} of surplus cash beyond what is needed.`)
  }

  if (rate >= 6.5) notes.push('Interest rate is high. Consider locking a rate and exploring down-payment assistance programs.')
  if (input.downPaymentPercent < 20) notes.push('Under 20% down means private mortgage insurance (PMI) will apply until 20% equity is reached.')

  return {
    grossMonthlyIncome,
    totalMonthlyIncome,
    totalRecurringExpenses,
    totalMonthlyDebtPayments,
    monthlyHousingBudget43: housingCap43,
    monthlyHousingBudget45: housingCap45,
    monthlyHousingBudget50: housingCap50,
    maxAffordableHousing: Math.max(0, cap - existingDebt),
    maxAffordableHomePrice: Math.round(price),
    estimatedLoanAmount: Math.round(best.loan),
    monthlyPrincipalInterest: Math.round(best.pi),
    monthlyTaxes: Math.round(best.tax),
    monthlyInsurance: Math.round(ins),
    mortgageInsurance: Math.round(mortgageInsurance),
    totalMonthlyPayment: Math.round(totalMonthlyPayment),
    backEndDTI: Number(dti.toFixed(1)),
    frontEndDTI: Number((totalMonthlyIncome > 0 ? (totalMonthlyPayment / totalMonthlyIncome) * 100 : 0).toFixed(1)),
    currentDTI: Number(currentDti.toFixed(1)),
    estimatedCashNeeded: Math.round(estimatedCashNeeded),
    shortOfCashBy: Math.round(shortOfCashBy),
    notes,
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const auth = verifyToken(token)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()

  // Gross income from paychecks (annualize from the pay-period frequency)
  const paychecks = ((await db.prepare(
    'SELECT * FROM budget_paychecks WHERE user_id = ? ORDER BY check_date DESC, pay_date DESC LIMIT 8'
  ).all(auth.userId)) as any[])

  let monthlyGross = 0
  let monthlyNet = 0
  let payPeriodsPerYear = 26
  if (paychecks.length > 0) {
    const avgGross = paychecks.reduce((s, p) => s + (Number(p.gross_pay) || 0), 0) / paychecks.length
    const avgNet = paychecks.reduce((s, p) => s + (Number(p.net_pay) || 0), 0) / paychecks.length
    // Detect biweekly vs weekly vs semi-monthly from the pay-period span
    const p = paychecks[0]
    if (p?.pay_period_begin && p?.pay_period_end) {
      const start = new Date(p.pay_period_begin)
      const end = new Date(p.pay_period_end)
      const days = Math.round((end.getTime() - start.getTime()) / 86400000)
      if (days <= 7) payPeriodsPerYear = 52
      else if (days <= 15) payPeriodsPerYear = 24
      else payPeriodsPerYear = 26
    }
    monthlyGross = (avgGross * payPeriodsPerYear) / 12
    monthlyNet = (avgNet * payPeriodsPerYear) / 12
  }

  // Recurring monthly expenses from bills
  const bills = ((await db.prepare(
    'SELECT COALESCE(b.payee_name, p.name) as payee_name, b.amount, b.is_recurring FROM budget_bills b LEFT JOIN budget_payees p ON b.payee_id = p.id WHERE b.user_id = ?'
  ).all(auth.userId)) as any[])
  const recurringExpenses = bills.map(b => ({ label: b.payee_name || 'Bill', amount: Number(b.amount) || 0 }))

  // Monthly debt payments: auto loans / personal loans from bank accounts of type loan
  const loanAccounts = ((await db.prepare(
    "SELECT name, current_balance, interest_rate FROM budget_bank_accounts WHERE user_id = ? AND is_active = 1 AND account_type = 'loan'"
  ).all(auth.userId)) as any[])
  const debts: Array<{ label: string; payment: number }> = []
  for (const loan of loanAccounts) {
    const bal = Number(loan.current_balance) || 0
    const apr = Number(loan.interest_rate) || 5
    // Estimate a 60-month payment
    const payment = monthlyPayment(bal, apr, 60)
    if (payment > 0) debts.push({ label: `${loan.name} (est. payment)`, payment: Math.round(payment) })
  }

  // Credit cards: minimum payment estimate ~3% of balance, $25 floor
  const cards = ((await db.prepare(
    'SELECT name, current_balance FROM budget_credit_cards WHERE user_id = ? AND is_active = 1'
  ).all(auth.userId)) as any[])
  for (const card of cards) {
    const bal = Number(card.current_balance) || 0
    if (bal > 0) {
      const min = Math.max(Math.round(bal * 0.03), 25)
      debts.push({ label: `${card.name} (est. min payment)`, payment: min })
    }
  }

  // Cash on hand from active non-loan bank accounts
  const cashOnHand = ((await db.prepare(
    "SELECT COALESCE(SUM(current_balance), 0) as t FROM budget_bank_accounts WHERE user_id = ? AND is_active = 1 AND account_type != 'loan'"
  ).get(auth.userId)) as any).t || 0

  return NextResponse.json({
    inputs: {
      monthlyGross,
      monthlyNet,
      payPeriodsPerYear,
      recurringMonthlyExpenses: recurringExpenses,
      existingMonthlyDebts: debts,
      cashOnHand,
    },
  })
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const auth = verifyToken(token)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const result = computeAffordability(body as AffordabilityInputs)
    return NextResponse.json({ result })
  } catch {
    return NextResponse.json({ error: 'Failed to compute affordability' }, { status: 500 })
  }
}
