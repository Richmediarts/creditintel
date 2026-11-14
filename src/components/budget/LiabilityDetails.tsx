'use client'

import { estimateLiability, LIABILITY_LABELS, sumLiens, type MortgageLien, type LiabilityKind } from '@/lib/utils/liability'

const fmt = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
export interface LiabilityFormValue { loan_kind: LiabilityKind; interest_rate: string; monthly_payment: string; liens?: { name: string; amount: number | null }[]; principal_interest_payment?: string }

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
      {value.loan_kind === 'mortgage' && (
        <>
          <label className="text-xs font-medium">Monthly principal &amp; interest ($)
            <input className={inputClass} type="number" min="0" step="0.01" placeholder="Unknown — exclude escrow" value={value.principal_interest_payment ?? ''}
              onChange={event => onChange({ ...value, principal_interest_payment: event.target.value })} />
          </label>
          <div className="col-span-full space-y-2">
            <p className="text-sm font-semibold">Attached liens</p>
            {(value.liens ?? []).map((lien, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_9rem_auto]">
                <label className="text-xs">Lien name
                  <input className={inputClass} value={lien.name} maxLength={200}
                    onChange={event => onChange({ ...value, liens: value.liens!.map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry) })} />
                </label>
                <label className="text-xs">Lien balance ($)
                  <input className={inputClass} type="number" min="0" step="0.01" value={lien.amount ?? ''} placeholder="Required"
                    onChange={event => onChange({ ...value, liens: value.liens!.map((entry, i) => i === index ? { ...entry, amount: event.target.value.trim() === '' ? null : Number(event.target.value) } : entry) })} />
                </label>
                <button type="button" aria-label={`Remove lien ${lien.name || index + 1}`} className="self-end rounded px-2 py-2 text-sm text-red-600"
                  onClick={() => onChange({ ...value, liens: value.liens!.filter((_, i) => i !== index) })}>Remove</button>
              </div>
            ))}
            <button type="button" className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
              onClick={() => onChange({ ...value, liens: [...(value.liens ?? []), { name: '', amount: null }] })}>Add lien</button>
            <p className="text-xs text-gray-600 dark:text-gray-400">Enter only separate lien balances that are not already included in the mortgage balance. Lien interest and payments are not assumed to match the mortgage.</p>
          </div>
          <p className="col-span-full text-xs text-gray-600 dark:text-gray-400">Keep escrow, property taxes and insurance out of the principal-and-interest amount used for payoff estimates.</p>
        </>
      )}
      <p className="col-span-full text-xs text-gray-600 dark:text-gray-400">Leave unknown terms blank. Enter 0% only when no interest applies. Payment amounts here are used for forecasts; schedule the actual payment in Household Bills.</p>
    </fieldset>
  )
}

export function LiabilityDetails({ balance, apr, payment, kind, liens = [], principalInterest }: {
  balance: number; apr: number | null; payment: number | null; kind?: LiabilityKind; liens?: MortgageLien[]; principalInterest?: number | null
}) {
  const estimate = estimateLiability(balance, apr, kind === 'mortgage' ? principalInterest : payment)
  const lienTotal = sumLiens(liens)
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
      {kind === 'mortgage' && <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">Total monthly payment: {payment == null ? 'Unknown' : fmt(payment)} · Principal &amp; interest used for payoff: {principalInterest == null ? 'Unknown' : fmt(principalInterest)}{payment != null && principalInterest != null && <> · Escrow / other excluded: {fmt(payment - principalInterest)}</>}. Mortgage estimates exclude the attached liens.</p>}
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([label, value]) => <div key={label}><dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt><dd className="mt-1 font-semibold tabular-nums text-gray-900 dark:text-white">{value}</dd></div>)}
      </dl>
      {liens.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 p-3 dark:border-amber-800">
        <h4 className="font-semibold text-gray-900 dark:text-white">Attached liens</h4>
        <dl className="mt-2 space-y-2 text-sm">{liens.map(lien => <div key={lien.name} className="flex justify-between gap-3"><dt>{lien.name}</dt><dd className="shrink-0 font-semibold tabular-nums">{fmt(lien.amount)}</dd></div>)}</dl>
        <p className="mt-3 text-sm">Total liens: <strong>{fmt(lienTotal)}</strong></p>
        <p className="mt-1 text-sm">Mortgage + liens: <strong>{fmt(balance + lienTotal)}</strong></p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Each lien is included once in liability totals. Lien interest terms remain unknown.</p>
      </div>}
      {estimate.status === 'unknown_rate' && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Enter the APR to estimate interest. An unknown rate is not treated as 0%.</p>}
      {estimate.status === 'payment_needed' && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{kind === 'mortgage' ? 'Enter the monthly principal-and-interest portion to estimate payoff.' : 'Enter a positive monthly payment to estimate payoff.'}</p>}
      {estimate.status === 'non_amortizing' && <p className="mt-3 text-sm text-red-600 dark:text-red-400">This payment does not cover estimated monthly interest. The balance will not decrease.</p>}
      {estimate.status === 'beyond_horizon' && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Payoff exceeds the 100-year estimate limit. Check your payment amount.</p>}
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Estimates assume a fixed APR, monthly interest and equal payments, with no new fees. The recorded balance changes only when you edit it or sync it. Actual lender or settlement terms may differ.</p>
    </div>
  )
}
