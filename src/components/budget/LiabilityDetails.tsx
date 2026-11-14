'use client'

import { estimateLiability, LIABILITY_LABELS, type LiabilityKind } from '@/lib/utils/liability'

const fmt = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
export interface LiabilityFormValue { loan_kind: LiabilityKind; interest_rate: string; monthly_payment: string }

export function LiabilityFields({ value, onChange, disabled = false }: {
  value: LiabilityFormValue
  onChange: (value: LiabilityFormValue) => void
  disabled?: boolean
}) {
  const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white'
  return (
    <fieldset disabled={disabled} className="col-span-full grid grid-cols-1 gap-3 rounded-xl bg-red-50/50 p-3 dark:bg-red-950/20 sm:grid-cols-3">
      <legend className="px-1 text-sm font-semibold">Liability terms</legend>
      <label className="text-xs font-medium">Liability type
        <select className={inputClass} value={value.loan_kind} onChange={event => onChange({ ...value, loan_kind: event.target.value as LiabilityKind })}>
          {Object.entries(LIABILITY_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium">Annual interest rate (%)
        <input className={inputClass} type="number" min="0" step="0.001" placeholder="Unknown" value={value.interest_rate}
          onChange={event => onChange({ ...value, interest_rate: event.target.value })} />
      </label>
      <label className="text-xs font-medium">Monthly payment ($)
        <input className={inputClass} type="number" min="0" step="0.01" placeholder="Unknown" value={value.monthly_payment}
          onChange={event => onChange({ ...value, monthly_payment: event.target.value })} />
      </label>
      <p className="col-span-full text-xs text-gray-600 dark:text-gray-400">Leave unknown terms blank. Enter 0% only when no interest applies. Payment amounts here are used for forecasts; schedule the actual payment in Household Bills.</p>
    </fieldset>
  )
}

export function LiabilityDetails({ balance, apr, payment }: { balance: number; apr: number | null; payment: number | null }) {
  const estimate = estimateLiability(balance, apr, payment)
  const items = [
    ['Recorded balance owed', fmt(balance)],
    ['Annual interest rate', apr == null ? 'Unknown' : apr + '%'],
    ['Monthly payment', payment == null ? 'Unknown' : fmt(payment)],
    ['Estimated next month interest', estimate.monthlyInterest == null ? 'Unknown' : fmt(estimate.monthlyInterest)],
    ['Estimated principal in next payment', estimate.principalNextPayment == null ? 'Unknown' : fmt(estimate.principalNextPayment)],
    ['Estimated months to payoff', estimate.payoffMonths == null ? 'Unknown' : String(estimate.payoffMonths)],
    ['Estimated future interest', estimate.futureInterest == null ? 'Unknown' : fmt(estimate.futureInterest)],
    ['Estimated total left with interest', estimate.totalRemaining == null ? 'Unknown' : fmt(estimate.totalRemaining)],
  ]
  return (
    <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([label, value]) => <div key={label}><dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt><dd className="mt-1 font-semibold tabular-nums text-gray-900 dark:text-white">{value}</dd></div>)}
      </dl>
      {estimate.status === 'unknown_rate' && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Enter the APR to estimate interest. An unknown rate is not treated as 0%.</p>}
      {estimate.status === 'payment_needed' && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Enter a positive monthly payment to estimate payoff.</p>}
      {estimate.status === 'non_amortizing' && <p className="mt-3 text-sm text-red-600 dark:text-red-400">This payment does not cover estimated monthly interest. The balance will not decrease.</p>}
      {estimate.status === 'beyond_horizon' && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Payoff exceeds the 100-year estimate limit. Check your payment amount.</p>}
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Estimates assume a fixed APR, monthly interest and equal payments, with no new fees. The recorded balance changes only when you edit it or sync it. Actual lender or settlement terms may differ.</p>
    </div>
  )
}
