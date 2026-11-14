export type LiabilityKind = 'auto' | 'settlement' | 'mortgage' | 'other'
export const LIABILITY_LABELS: Record<LiabilityKind, string> = {
  auto: 'Auto Loan', settlement: 'Law Settlement', mortgage: 'Mortgage', other: 'Other Loan',
}

export interface MortgageLien { name: string; amount: number }
export function sumLiens(liens: MortgageLien[] = []): number {
  return liens.reduce((total, lien) => total + Math.round(lien.amount * 100), 0) / 100
}

/** Fixed-rate monthly estimate; recorded balances are never automatically increased. */
export function estimateLiability(balance: number, apr: number | null | undefined, payment: number | null | undefined) {
  const result = {
    monthlyInterest: null as number | null,
    principalNextPayment: null as number | null,
    payoffMonths: null as number | null,
    futureInterest: null as number | null,
    totalRemaining: null as number | null,
    status: 'unknown_rate' as 'unknown_rate' | 'payment_needed' | 'non_amortizing' | 'estimated' | 'paid_off' | 'beyond_horizon',
  }
  if (!Number.isFinite(balance) || balance < 0) return result
  if (balance === 0) return { ...result, monthlyInterest: 0, principalNextPayment: 0, payoffMonths: 0, futureInterest: 0, totalRemaining: 0, status: 'paid_off' as const }
  if (apr == null || !Number.isFinite(apr) || apr < 0) return result
  const cents = (value: number) => Math.round((value + Number.EPSILON) * 100)
  const monthlyRate = apr / 1200
  const starting = cents(balance)
  const firstInterest = Math.round(starting * monthlyRate)
  result.monthlyInterest = firstInterest / 100
  if (payment == null || !Number.isFinite(payment) || payment <= 0) return { ...result, status: 'payment_needed' as const }
  const paymentCents = cents(payment)
  result.principalNextPayment = Math.min(starting, Math.max(0, paymentCents - firstInterest)) / 100
  if (paymentCents <= firstInterest) return { ...result, status: 'non_amortizing' as const }
  let remaining = starting
  let totalInterest = 0
  for (let month = 1; month <= 1200; month++) {
    const interest = Math.round(remaining * monthlyRate)
    totalInterest += interest
    remaining = Math.max(0, remaining + interest - paymentCents)
    if (remaining === 0) return {
      ...result, payoffMonths: month, futureInterest: totalInterest / 100,
      totalRemaining: (starting + totalInterest) / 100, status: 'estimated' as const,
    }
  }
  return { ...result, status: 'beyond_horizon' as const }
}

export function validateLiabilityTerms(data: Record<string, unknown>): string | null {
  if (data.loan_kind !== undefined && !['auto', 'settlement', 'mortgage', 'other'].includes(String(data.loan_kind))) return 'Choose Auto Loan, Law Settlement, Mortgage, or Other Loan.'
  for (const [field, label] of [['interest_rate', 'Annual interest rate'], ['monthly_payment', 'Monthly payment'], ['principal_interest_payment', 'Principal-and-interest payment']] as const) {
    const value = data[field]
    if (value !== undefined && value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return label + ' must be zero or a positive number, or left unknown.'
  }
  if (data.account_type === 'loan' && (typeof data.current_balance !== 'number' || !Number.isFinite(data.current_balance) || data.current_balance < 0)) return 'Enter the current amount owed as zero or a positive number.'
  if (data.liens !== undefined) {
    if (!Array.isArray(data.liens) || data.liens.length > 30) return 'Enter a valid list of up to 30 liens.'
    if (data.liens.length && (data.loan_kind !== 'mortgage' || data.account_type !== 'loan')) return 'Liens must be attached to a mortgage liability.'
    const names = new Set<string>()
    for (const lien of data.liens) {
      if (!lien || typeof lien !== 'object' || typeof lien.name !== 'string' || !lien.name.trim() || lien.name.trim().length > 200 ||
        typeof lien.amount !== 'number' || !Number.isFinite(lien.amount) || lien.amount < 0) return 'Each lien needs a name and a known, non-negative balance.'
      const name = lien.name.trim().toLowerCase()
      if (names.has(name)) return 'Enter each lien once.'
      names.add(name)
    }
  }
  if (typeof data.principal_interest_payment === 'number' && typeof data.monthly_payment === 'number' && data.principal_interest_payment > data.monthly_payment) return 'Principal and interest cannot exceed the total monthly payment.'
  return null
}
