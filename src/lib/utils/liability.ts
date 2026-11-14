export type LiabilityKind = 'auto' | 'settlement' | 'other'
export const LIABILITY_LABELS: Record<LiabilityKind, string> = {
  auto: 'Auto Loan', settlement: 'Law Settlement', other: 'Other Loan',
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
  if (data.loan_kind !== undefined && !['auto', 'settlement', 'other'].includes(String(data.loan_kind))) return 'Choose Auto Loan, Law Settlement, or Other Loan.'
  for (const [field, label] of [['interest_rate', 'Annual interest rate'], ['monthly_payment', 'Monthly payment']] as const) {
    const value = data[field]
    if (value !== undefined && value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return label + ' must be zero or a positive number, or left unknown.'
  }
  if (data.account_type === 'loan' && (typeof data.current_balance !== 'number' || !Number.isFinite(data.current_balance) || data.current_balance < 0)) return 'Enter the current amount owed as zero or a positive number.'
  return null
}
