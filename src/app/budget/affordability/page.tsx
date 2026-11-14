'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Home, RefreshCw, ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import type { HomeSourceData } from '@/lib/home-affordability-data'
import {
  buildHomePlan, validateHomePlan, HOME_DEFAULTS, type HomeAssumptions,
  type HomeDebt, type HomeExpense, type PurchaseTiming,
} from '@/lib/utils/home-affordability'
import { sumLiens } from '@/lib/utils/liability'

const money = (value: number | null | undefined) => value == null ? 'Unknown' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const precise = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
const percent = (value: number | null) => value == null ? 'Unknown' : value.toFixed(1) + '%'
const timingNotes: Record<PurchaseTiming, string> = {
  'sell-first': 'Sale cash is received first, old mortgage is paid off, and temporary housing costs are deducted.',
  coordinated: 'Assumes your sale funds and lien releases are available before your purchase funds. Confirm timing and lender approval.',
  'buy-first': 'Sale equity is unavailable. Both mortgage payments count, and the overlap payment reserve is set aside.',
}
const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white'

export default function AffordabilityPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [source, setSource] = useState<HomeSourceData | null>(null)
  const [form, setForm] = useState<HomeAssumptions>({ ...HOME_DEFAULTS })
  const [debts, setDebts] = useState<HomeDebt[]>([])
  const [expenses, setExpenses] = useState<HomeExpense[]>([])
  const [mortgageId, setMortgageId] = useState(0)
  const [reload, setReload] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const storageKey = user ? 'home-sale-plan-v2:' + user.id : ''

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (!user) return
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/budget/affordability', { signal: controller.signal })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Unable to load the home plan.')
        if (controller.signal.aborted) return
        const data = body.data as HomeSourceData
        const mortgage = data.mortgages.find(item => /pennymac/i.test(item.name)) ?? data.mortgages[0] ?? null
        let assumptions = { ...data.assumptions }
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
          if (saved) {
            const candidate = { ...assumptions, ...saved, monthlyGrossIncome: data.assumptions.monthlyGrossIncome, monthlyNetIncome: data.assumptions.monthlyNetIncome, cashOnHand: data.assumptions.cashOnHand, currentMonthlyHOA: data.assumptions.currentMonthlyHOA }
            if (validateHomePlan({ assumptions: candidate, mortgage, debts: data.debts, expenses: data.expenses })) assumptions = candidate
          }
        } catch { /* Live data remains available when browser storage is unavailable. */ }
        setSource(data)
        setMortgageId(mortgage?.id ?? 0)
        setForm(assumptions)
        setDebts(data.debts)
        setExpenses(data.expenses)
        setError('')
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load the home plan.')
      } finally { if (!controller.signal.aborted) setRefreshing(false) }
    }
    void load()
    return () => controller.abort()
  }, [user, authLoading, router, reload, storageKey])

  useEffect(() => {
    if (!source || !storageKey) return
    // Only what-if assumptions persist. Income, cash, debt balances and liabilities reload live.
    const saved = { ...form } as Partial<HomeAssumptions>
    delete saved.monthlyGrossIncome
    delete saved.monthlyNetIncome
    delete saved.cashOnHand
    delete saved.currentMonthlyHOA
    try { localStorage.setItem(storageKey, JSON.stringify(saved)) } catch { /* Optional persistence. */ }
  }, [form, source, storageKey])

  const mortgage = source?.mortgages.find(item => item.id === mortgageId) ?? null
  const input = useMemo(() => ({
    assumptions: form, mortgage, expenses,
    debts: [...debts, ...(source?.mortgages ?? []).filter(item => item.id !== mortgageId).map(item => ({
      id: 'other-mortgage-' + item.id, label: item.name + ' (not sold)', balance: item.balance + sumLiens(item.liens),
      payment: item.payment, source: 'Other mortgage retained in DTI', payoff: false,
    }))],
  }), [form, mortgage, expenses, debts, source, mortgageId])
  const plan = useMemo(() => validateHomePlan(input) ? buildHomePlan(input) : null, [input])
  const preferred = plan?.scenarios[0]
  const lienTotal = sumLiens(mortgage?.liens)
  const update = (key: keyof HomeAssumptions, value: number | null) => setForm(previous => ({ ...previous, [key]: value }))
  const field = (label: string, key: keyof HomeAssumptions, options: { step?: string; nullable?: boolean; help?: string; max?: number } = {}) => (
    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
      {label}
      <input className={inputClass} type="number" min={key === 'cashOnHand' ? undefined : 0} max={options.max}
        step={options.step ?? '0.01'} placeholder={options.nullable ? 'Unknown / use saved balance' : undefined}
        value={form[key] ?? ''}
        onChange={event => update(key, event.target.value.trim() === '' && options.nullable ? null : Number(event.target.value))} />
      {options.help && <span className="mt-1 block text-xs font-normal text-gray-500">{options.help}</span>}
    </label>
  )
  const refresh = () => { setRefreshing(true); setReload(value => value + 1) }

  if (authLoading || (!source && !error)) return <p role="status" className="py-12 text-center">Loading mortgage, liens and household budget…</p>
  if (!user) return null
  if (!source) return <div role="alert" className="space-y-3 p-6"><p>{error}</p><Button onClick={refresh}>Try again</Button></div>

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/budget" aria-label="Back to budget"><ArrowLeft className="h-5 w-5" /></Link>
          <div><h1 className="text-xl font-bold text-gray-900 dark:text-white">Home Affordability &amp; DTI Calculator</h1>
            <p className="mt-1 text-sm text-gray-500">Sell your current home, clear its mortgage and liens, and plan the next purchase.</p></div>
        </div>
        <Button onClick={refresh} disabled={refreshing} variant="secondary"><RefreshCw className="mr-2 h-4 w-4" />{refreshing ? 'Refreshing…' : 'Refresh live data'}</Button>
      </header>
      {(source.currentLocation || source.buyingLocation) && <p className="text-sm text-gray-500">Selling: {source.currentLocation || 'Your current home'} · Considering: {source.buyingLocation || 'New home location'}. Local taxes, insurance and quotes still need verification.</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

      <Card><CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Your current mortgage and liens</h2>
          <Link href="/budget/bank-accounts" className="text-sm text-blue-600 dark:text-blue-400 underline">Edit liability accounts</Link>
        </div>
        {source.mortgages.length > 1 && <label className="block max-w-sm text-sm">Mortgage to sell<select className={inputClass} value={mortgageId} onChange={event => setMortgageId(Number(event.target.value))}>{source.mortgages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {mortgage ? <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric label={mortgage.name + ' balance'} value={precise(mortgage.balance)} />
            <Metric label="Attached liens" value={precise(lienTotal)} />
            <Metric label="Recorded payoff base" value={precise(mortgage.balance + lienTotal)} />
            <Metric label="Current mortgage incl. escrow" value={money(mortgage.payment)} />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-300">{mortgage.liens.map(lien => <span key={lien.name}>{lien.name}: <strong>{precise(lien.amount)}</strong></span>)}</div>
          <p className="text-xs text-gray-500">Current APR {mortgage.apr == null ? 'unknown' : mortgage.apr + '%'} stays with this loan. The replacement mortgage uses the new-rate assumption below. Sale deductions use recorded balances unless you enter an official mortgage payoff override. Both lien payoffs and releases still need closing confirmation.</p>
        </> : <p className="text-sm text-amber-700">Add a mortgage liability to connect your home-sale plan.</p>}
      </CardContent></Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card><CardContent className="space-y-4 p-5">
          <h2 className="font-semibold">1. Estimate your sale proceeds</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field('Expected sale price ($)', 'salePrice', { nullable: true })}
            {field('Negotiated agent compensation (%)', 'sellerAgentPercent', { help: 'Planning assumption; request written quotes.' })}
            {field('Other seller closing costs (%)', 'sellerOtherPercent')}
            {field('Repairs + buyer credits ($)', 'repairsAndCredits')}
            {field('Official mortgage payoff override ($)', 'mortgagePayoffOverride', { nullable: true, help: 'Mortgage only. Both attached liens are still deducted separately.' })}
            {field('Additional payoff fees / interest ($)', 'payoffExtra', { help: 'Only amounts not already in a payoff quote.' })}
          </div>
          {plan?.sale ? <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <dl className="space-y-2 text-sm">
              <MoneyRow label="Expected sale price" value={plan.sale.price} />
              <MoneyRow label="Agent compensation" value={-plan.sale.agentCosts} />
              <MoneyRow label="Other seller closing costs" value={-plan.sale.otherCosts} />
              <MoneyRow label="Repairs / credits" value={-form.repairsAndCredits} />
              <MoneyRow label="Mortgage payoff" value={-plan.sale.mortgagePayoff} />
              {mortgage?.liens.map(lien => <MoneyRow key={lien.name} label={lien.name} value={-lien.amount} />)}
              <MoneyRow label="Other payoff fees / interest" value={-form.payoffExtra} />
              <MoneyRow label="Estimated net sale proceeds" value={plan.sale.net} bold />
            </dl>
            <p className="mt-3 text-xs text-gray-500">Estimated break-even sale price: {money(plan.sale.breakEvenPrice)} before moving and temporary housing. {plan.sale.net < 0 ? 'Negative proceeds are a cash shortfall, not usable equity.' : 'Proceeds become usable only after the sale funds.'}</p>
          </div> : <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">Enter a sale price to see proceeds and the sell-first purchase range.</p>}
        </CardContent></Card>

        <Card><CardContent className="space-y-4 p-5">
          <h2 className="font-semibold">2. Review income, cash and transition costs</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field('Household gross monthly income ($)', 'monthlyGrossIncome')}
            {field('Household take-home monthly income ($)', 'monthlyNetIncome')}
            {field('Selected bank cash to use ($)', 'cashOnHand', { help: source.selectedCashSource + '; edit if part is unavailable.' })}
            {field('Extra cash not already counted ($)', 'extraCash')}
            {field('Monthly cash-flow cushion ($)', 'monthlyCashBuffer')}
            {field('Moving costs ($)', 'movingCosts')}
            {field('Temporary housing total — sell first ($)', 'temporaryHousingCosts')}
            {field('Current home HOA / month ($)', 'currentMonthlyHOA')}
            {field('Monthly lien payments before sale ($)', 'currentLienMonthlyPayment', { nullable: true, help: 'Buy-first requires this. Enter 0 only if no periodic lien payments are required.' })}
            {field('Old-mortgage overlap months — buy first', 'overlapMonths', { step: '1', max: 24 })}
          </div>
          {source.confirmedGrossIncome != null && <p className="text-sm text-blue-700 dark:text-blue-300">Owner-confirmed gross household income: {money(source.confirmedGrossIncome)} per month. Take-home income still uses recorded paychecks; update it if incomplete.</p>}
          <p className="text-xs text-gray-500">{source.incomeSource}. All amounts are editable assumptions. Refresh reloads income, cash, debts and liabilities; other assumptions stay saved in this browser.</p>
          <ul className="space-y-1 text-xs text-gray-500">{source.incomeBreakdown.map(row => <li key={row.name}>{row.name}: {money(row.monthlyGross)} gross / {money(row.monthlyNet)} take-home per month ({row.periodsPerYear} pay periods/year)</li>)}</ul>
          {source.warnings.map(warning => <p key={warning} className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>)}
        </CardContent></Card>
      </div>

      <Card><CardContent className="space-y-4 p-5">
        <h2 className="font-semibold">3. Set assumptions for the next home</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {field('Down payment (%)', 'downPaymentPercent', { max: 100 })}
          {field('New mortgage rate (%)', 'interestRate', { max: 30 })}
          {field('Loan term (years)', 'termYears', { step: '1', max: 50 })}
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Planning total DTI target<select className={inputClass} value={form.targetDtiPercent} onChange={event => update('targetDtiPercent', Number(event.target.value))}><option value={36}>36% — more conservative</option><option value={43}>43% — comparison</option><option value={45}>45% — stretch</option><option value={50}>50% — high, lender review</option></select></label>
          {field('Property tax rate (% / year)', 'propertyTaxRate', { max: 20 })}
          {field('Annual homeowners insurance ($)', 'annualInsurance')}
          {field('Monthly HOA ($)', 'monthlyHOA')}
          {field('PMI (% of loan / year, under 20% down)', 'annualPmiPercent', { max: 10 })}
          {field('Buyer closing costs (%)', 'buyerClosingPercent', { max: 30 })}
          {field('Emergency reserve (months of outgoings)', 'reserveMonths', { step: '1', max: 24 })}
        </div>
        <p className="text-xs text-gray-500">Moving, temporary housing, repairs, extra payoff fees and any tax impacts are not estimated automatically; enter actual net-sheet costs before relying on the ceiling. Initial new-rate assumption: 7.11%, Freddie Mac 30-year survey dated November 12, 2026; this is not a lender quote. Taxes, insurance, PMI and selling-cost percentages are editable planning assumptions, not local quotes. No loan-program eligibility is assumed.</p>
      </CardContent></Card>

      {!plan && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Review the inputs. Amounts must be finite, fees cannot consume 100% of the sale, and DTI / loan terms must stay within the displayed limits.</p>}
      {plan && <>
        <section className="rounded-2xl bg-blue-950 p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Sell-first planning purchase ceiling</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><p className="text-xs text-blue-200">With your current payoff selections</p><p className="mt-1 text-3xl font-bold">{preferred?.price == null ? 'More information needed' : money(preferred.price)}</p></div>
            <div><p className="text-xs text-blue-200">Best of tested full-debt-payoff allocations</p><p className="mt-1 text-3xl font-bold">{money(plan.payoffComparisons[0]?.scenario.price)}</p><p className="mt-1 text-xs text-blue-200">Review payoff cost and apply a what-if allocation below.</p></div>
          </div>
          {preferred?.missing.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-blue-100">{preferred.missing.map(message => <li key={message}>{message}</li>)}</ul> : <>
            <p className="mt-2 text-sm text-blue-100">Limited by {preferred?.bindingLimit?.toLowerCase()}. Includes down payment, buyer closing costs, reserves, taxes, insurance, HOA and modeled PMI.</p>
            <p className="mt-2 text-sm text-blue-100">Planning preference: sell first to avoid carrying two homes. Coordinated closings may preserve more cash if timing is confirmed. Compare all three below.</p>
          </>}
          <p className="mt-3 text-xs text-blue-200">This is a cash-flow and DTI scenario, not preapproval or a guaranteed purchase amount. Lender rules, credit, title clearance, actual payoff quotes and local costs can change the result.</p>
        </section>
        <section aria-label="Sale and purchase timing comparison" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {plan.scenarios.map(scenario => <Card key={scenario.timing}><CardContent className="space-y-3 p-5">
            <h3 className="font-semibold">{scenario.label}</h3>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{scenario.price == null ? 'Needs inputs' : money(scenario.price)}</p>
            <p className="text-xs text-gray-500">{timingNotes[scenario.timing]}</p>
            {scenario.missing.length > 0 && <p className="text-sm text-amber-700 dark:text-amber-300">{scenario.missing.join(' ')}</p>}
            <dl className="space-y-2 text-sm">
              <MoneyRow label="Funds for purchase + reserves" value={scenario.fundsForPurchase} />
              <MoneyRow label="One-time transition costs" value={scenario.transitionCosts} />
              <MoneyRow label="Optional debt payoff cash" value={scenario.payoffCash} />
              <MoneyRow label="Old housing payment retained in DTI" value={scenario.holdingPayment} />
              <MoneyRow label="Estimated new housing / month" value={scenario.purchase?.housing.total} />
              <MoneyRow label="Down payment" value={scenario.purchase?.down} />
              <MoneyRow label="Buyer closing costs" value={scenario.purchase?.closing} />
              <MoneyRow label="Cash reserves retained" value={scenario.purchase?.reserve} />
              <MoneyRow label="Monthly cash after bills + housing" value={scenario.monthlySurplus} />
              <div className="flex justify-between gap-2"><dt>Total DTI</dt><dd>{percent(scenario.actualDti)}</dd></div>
            </dl>
            {scenario.ready && scenario.price === 0 && <p className="text-sm text-red-600 dark:text-red-400">No purchase fits these assumptions. Review cash, missing expenses and monthly debt obligations.</p>}
          </CardContent></Card>)}
        </section>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card><CardContent className="p-5">
            <h2 className="mb-3 font-semibold">Purchase range by DTI target — sell first</h2>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-gray-500"><th className="p-2">Target</th><th className="p-2">Purchase ceiling</th><th className="p-2">Housing / month</th></tr></thead>
              <tbody>{plan.dtiComparison.map(row => <tr key={row.dtiTarget} className="border-t border-gray-200 dark:border-gray-700"><td className="p-2">{row.dtiTarget}%</td><td className="p-2 font-semibold">{money(row.price)}</td><td className="p-2">{money(row.purchase?.housing.total)}</td></tr>)}</tbody></table></div>
            <p className="mt-3 text-xs text-gray-500">A higher DTI target may not increase the price if cash or take-home cash flow is the limiting factor. Fannie Mae limits vary by underwriting method and borrower qualifications.</p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <h2 className="mb-3 font-semibold">If your home sells for less or more</h2>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-gray-500"><th className="p-2">Sale price</th><th className="p-2">Net proceeds</th><th className="p-2">Purchase ceiling</th></tr></thead>
              <tbody>{plan.sensitivity.map(row => <tr key={row.sale?.price} className="border-t border-gray-200 dark:border-gray-700"><td className="p-2">{money(row.sale?.price)}</td><td className="p-2">{money(row.sale?.net)}</td><td className="p-2">{money(row.scenario.price)}</td></tr>)}</tbody></table></div>
            {!plan.sensitivity.length && <p className="text-sm text-gray-500">Enter your expected sale price to compare ±5% outcomes.</p>}
          </CardContent></Card>
        </div>
      </>}

      {plan && <Card><CardContent className="space-y-4 p-5">
        <h2 className="font-semibold">Compare using sale cash to clear other debts</h2>
        <p className="text-sm text-gray-500">These are the strongest purchase ceilings among the tested full-payoff allocations at your selected down payment and DTI. This is not a global optimum or a recommendation to pay creditors without checking actual payoff amounts. Unknown balances are not automatically selected.</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">{plan.payoffComparisons.map((option, index) => <div key={option.ids.join('|')} className="space-y-2 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-sm font-semibold">{index === 0 ? 'Highest ceiling among compared allocations' : 'Alternative allocation'}</p>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{money(option.scenario.price)}</p>
          <p className="text-xs text-gray-500">{option.labels.length ? 'Pay off: ' + option.labels.join(', ') : 'Keep other debts; use cash for the purchase.'}</p>
          <dl className="space-y-1 text-sm"><MoneyRow label="Full payoff cash" value={option.scenario.payoffCash} /><MoneyRow label="Monthly payments removed" value={option.monthlyPaymentFreed} /><MoneyRow label="New housing / month" value={option.scenario.purchase?.housing.total} /></dl>
          <Button size="sm" variant="secondary" onClick={() => setDebts(rows => rows.map(row => ({ ...row, payoff: option.ids.includes(row.id) })))}>Use this what-if allocation</Button>
        </div>)}</div>
        <p className="text-xs text-gray-500">Clicking an allocation changes this calculator only. It does not send payments or mark debts paid. Required monthly payments on debts without known payoff balances remain in DTI.</p>
      </CardContent></Card>}

      {plan && <Card><CardContent className="space-y-4 p-5">
        <h2 className="font-semibold">Low or zero down — compare cash and monthly cost</h2>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="text-gray-500"><tr><th className="p-2">Down payment</th><th className="p-2">Purchase ceiling</th><th className="p-2">Cash: down + closing</th><th className="p-2">Reserves kept</th><th className="p-2">Housing / month</th></tr></thead>
          <tbody>{plan.downPaymentComparison.map(row => <tr key={row.downPaymentPercent} className="border-t border-gray-200 dark:border-gray-700">
            <td className="p-2">{row.downPaymentPercent}%{row.conditional && <span className="block text-xs text-amber-700 dark:text-amber-300">Eligibility unconfirmed</span>}</td>
            <td className="p-2 font-semibold">{money(row.scenario.price)}</td>
            <td className="p-2">{row.scenario.purchase ? money(row.scenario.purchase.down + row.scenario.purchase.closing) : 'Unknown'}</td>
            <td className="p-2">{money(row.scenario.purchase?.reserve)}</td>
            <td className="p-2">{money(row.scenario.purchase?.housing.total)}</td>
          </tr>)}</tbody></table></div>
        <p className="text-sm text-amber-800 dark:text-amber-200">Zero down does not mean zero closing costs or reserves. VA eligibility is {source.vaEligibility === 'unknown' ? 'unconfirmed' : source.vaEligibility}. These are financing what-ifs using the displayed rate and insurance assumptions, not VA, USDA or FHA program quotes. Program-specific mortgage insurance and upfront fees can change the price limit.</p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600 dark:text-gray-300">
          <li><a className="underline" href="https://www.va.gov/housing-assistance/home-loans/loan-types/purchase-loan/" target="_blank" rel="noreferrer">VA purchase loans</a>: confirm a Certificate of Eligibility first. Qualifying VA purchases can require no down payment and no monthly mortgage insurance; funding fees and other costs may apply.</li>
          <li><a className="underline" href="https://www.rd.usda.gov/programs-services/single-family-housing-programs/single-family-housing-guaranteed-loan-program" target="_blank" rel="noreferrer">USDA eligibility</a>: verify the exact Cobb County or Sandy Springs property and household-income limits. A city or county name alone does not establish eligibility.</li>
          <li><a className="underline" href="https://yourhome.fanniemae.com/buy/homeready" target="_blank" rel="noreferrer">Low-down conventional options</a> and <a className="underline" href="https://georgia.gov/apply-georgia-dream-homeownership-program" target="_blank" rel="noreferrer">Georgia Dream</a>: ask a participating lender to check borrower, income, asset, prior-homeownership and purchase-price limits before counting on assistance. No assistance money is included here.</li>
        </ul>
      </CardContent></Card>}

      <Card><CardContent className="space-y-4 p-5">
        <button type="button" className="flex w-full items-center justify-between text-left font-semibold" aria-expanded={showDetails} aria-controls="home-debt-details" onClick={() => setShowDetails(value => !value)}>
          <span>Review debts, full-payoff choices and living expenses</span><span>{showDetails ? '−' : '+'}</span>
        </button>
        <div id="home-debt-details" hidden={!showDetails} className="space-y-5">
          <p className="text-sm text-gray-500">Current DTI: {percent(plan?.currentDti ?? null)}. Ordinary living bills are excluded from lender DTI and included in take-home cash flow. Completing a full debt payoff removes its monthly payment only after the entire payoff cash is set aside.</p>
          {debts.map((debt, index) => <div key={debt.id} className="grid grid-cols-1 items-end gap-3 border-t border-gray-200 pt-3 dark:border-gray-700 sm:grid-cols-[1fr_8rem_8rem_auto]">
            <div><p className="text-sm font-medium">{debt.label}</p><p className="text-xs text-gray-500">{debt.source}</p></div>
            <label className="text-xs">Balance owed<input className={inputClass} type="number" min="0" step="0.01" value={debt.balance ?? ''} placeholder="Unknown" onChange={event => setDebts(rows => rows.map((row, i) => i === index ? { ...row, balance: event.target.value === '' ? null : Number(event.target.value) } : row))} /></label>
            <label className="text-xs">Monthly payment<input className={inputClass} type="number" min="0" step="0.01" value={debt.payment ?? ''} placeholder="Required" onChange={event => setDebts(rows => rows.map((row, i) => i === index ? { ...row, payment: event.target.value === '' ? null : Number(event.target.value) } : row))} /></label>
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={debt.payoff} onChange={event => setDebts(rows => rows.map((row, i) => i === index ? { ...row, payoff: event.target.checked } : row))} />Pay off in full</label>
          </div>)}
          <Button variant="secondary" size="sm" onClick={() => setDebts(rows => [...rows, { id: 'manual-' + Date.now(), label: 'Other monthly debt', balance: null, payment: null, source: 'Manual assumption', payoff: false }])}>Add other debt</Button>
          <h3 className="font-semibold">Non-debt living expenses</h3>
          <p className="text-xs text-gray-500">Review groceries, utilities, transport and medical costs that may not be in recurring bills. Remove costs already included in mortgage escrow. Editing these assumptions does not change your saved bills.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{expenses.map((expense, index) => <div key={expense.id} className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-xs">{expense.label}<input className={inputClass} type="number" min="0" step="0.01" value={expense.amount ?? ''} placeholder="Unknown" onChange={event => setExpenses(rows => rows.map((row, i) => i === index ? { ...row, amount: event.target.value === '' ? null : Number(event.target.value) } : row))} /></label>
            <button type="button" className="rounded px-2 py-2 text-xs text-red-600" aria-label={'Remove ' + expense.label} onClick={() => setExpenses(rows => rows.filter((_, i) => i !== index))}>Remove</button>
          </div>)}</div>
          <Button variant="secondary" size="sm" onClick={() => setExpenses(rows => [...rows, { id: 'manual-' + Date.now(), label: 'Additional living expenses', amount: null }])}>Add living expense</Button>
          <p className="text-xs text-gray-500">Debt and expense edits are temporary what-if inputs and reload from your budget next visit. Update the actual account or bill to change the source data.</p>
        </div>
      </CardContent></Card>

      <Card><CardContent className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><Home className="h-5 w-5" />A practical sell-and-buy sequence</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700 dark:text-gray-300">
          <li>Request a dated PennyMac payoff quote, the HUD partial-claim payoff, and confirmation of the Midland judgment payoff and release requirements from your closing attorney or title professional. Recorded balances are estimates, and lien/title treatment needs confirmation.</li>
          <li>Request written seller net sheets from competing agents. Compare the same sale price after negotiated compensation, seller credits, repairs, closing charges and every lien—not just the advertised sale price.</li>
          <li>Get purchase preapproval using verified household income and debt payments, then compare multiple Loan Estimates. Check the new rate, taxes, insurance, PMI and reserves against the calculator.</li>
          <li>Use sell-first as the lower-overlap planning approach. Coordinate a purchase contingency or temporary housing with your agent and lender. Use coordinated closings only after confirming fund availability; buying first assumes both housing payments and no access to unsold equity.</li>
        </ol>
        <p className="text-xs text-gray-500">Sources: <a className="underline" href="https://www.consumerfinance.gov/ask-cfpb/what-is-a-payoff-amount-and-is-it-the-same-as-my-current-balance-en-205/" target="_blank" rel="noreferrer">CFPB payoff amounts</a> · <a className="underline" href="https://www.consumerfinance.gov/owning-a-home/loan-estimate/" target="_blank" rel="noreferrer">Compare Loan Estimates</a> · <a className="underline" href="https://selling-guide.fanniemae.com/sel/b3-6-02/debt-income-ratios" target="_blank" rel="noreferrer">DTI rules</a> · <a className="underline" href="https://selling-guide.fanniemae.com/sel/b3-6-06/qualifying-impact-other-real-estate-owned" target="_blank" rel="noreferrer">Pending-sale housing debt</a> · <a className="underline" href="https://www.freddiemac.com/pmms" target="_blank" rel="noreferrer">Rate benchmark</a></p>
      </CardContent></Card>
    </div>
  )
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{value}</p></div>
}
function MoneyRow({ label, value, bold = false }: { label: string; value: number | null | undefined; bold?: boolean }) {
  return <div className={'flex justify-between gap-3 ' + (bold ? 'border-t border-gray-300 pt-2 font-semibold dark:border-gray-600' : '')}><dt>{label}</dt><dd className={'shrink-0 tabular-nums ' + (value != null && value < 0 ? 'text-red-600 dark:text-red-400' : '')}>{money(value)}</dd></div>
}
