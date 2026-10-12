'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Home, Calculator, RefreshCw, Info, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { maximumFractionDigits: 0 })

interface Debt { label: string; payment: number }
interface Expense { label: string; amount: number }

interface Result {
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

const EMPTY = {
  monthlyGrossIncome: 0,
  monthlyOtherIncome: 0,
  downPaymentPercent: 20,
  interestRate: 6.5,
  termYears: 30,
  propertyTaxRate: 1.0,
  annualHomeInsurance: 1800,
  monthlyHOA: 0,
  miOrMcl: 0,
  closingCostsPercent: 3,
  cashOnHand: 0,
  reservesMonths: 2,
}

function dtiColor(dti: number) {
  if (dti <= 36) return { text: 'text-emerald-600 dark:text-emerald-400', variant: 'success' as const, label: 'Excellent' }
  if (dti <= 43) return { text: 'text-green-600 dark:text-green-400', variant: 'success' as const, label: 'Good' }
  if (dti <= 45) return { text: 'text-yellow-600 dark:text-yellow-400', variant: 'warning' as const, label: 'Borderline' }
  if (dti <= 50) return { text: 'text-orange-600 dark:text-orange-400', variant: 'warning' as const, label: 'High' }
  return { text: 'text-red-600 dark:text-red-400', variant: 'danger' as const, label: 'Too High' }
}

export default function AffordabilityPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [form, setForm] = useState({ ...EMPTY })
  const [debts, setDebts] = useState<Debt[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [editMode, setEditMode] = useState<'debts' | 'expenses' | null>(null)

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (!user) return
    fetch('/api/budget/affordability')
      .then(r => r.json())
      .then(d => {
        if (d.inputs) {
          setForm(f => ({
            ...f,
            monthlyGrossIncome: Math.round(d.inputs.monthlyGross || 0),
            cashOnHand: Math.round(d.inputs.cashOnHand || 0),
          }))
          setDebts(d.inputs.existingMonthlyDebts || [])
          setExpenses(d.inputs.recurringMonthlyExpenses || [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user, authLoading])

  const calculate = async () => {
    setComputing(true)
    const res = await fetch('/api/budget/affordability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        existingMonthlyDebts: debts,
        recurringMonthlyExpenses: expenses,
      }),
    })
    const data = await res.json()
    if (data.result) setResult(data.result)
    setComputing(false)
  }

  // Auto-calculate whenever inputs change
  useEffect(() => {
    if (!loading && form.monthlyGrossIncome > 0) { calculate() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, debts, expenses, loading])

  const dti = result ? dtiColor(result.backEndDTI) : null
  const totalMonthlyOutflow = useMemo(
    () => (result ? result.totalMonthlyPayment + result.totalRecurringExpenses + result.totalMonthlyDebtPayments : 0),
    [result]
  )
  const monthlySurplus = useMemo(
    () => (result ? result.totalMonthlyIncome - totalMonthlyOutflow : 0),
    [result, totalMonthlyOutflow]
  )

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }
  if (!user) return null

  const field = (label: string, key: keyof typeof EMPTY, step = '1', prefix?: string, suffix?: string) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{prefix}</span>}
        <input
          type="number"
          step={step}
          value={String(form[key])}
          onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) || 0 }))}
          className={`w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-8' : ''}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/budget" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Home Affordability &amp; DTI Calculator</h1>
            <p className="text-sm text-gray-500">Georgia home-buying analysis using your live income, bills, and debts.</p>
          </div>
        </div>
        <Button onClick={calculate} disabled={computing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${computing ? 'animate-spin' : ''}`} /> Recalculate
        </Button>
      </div>

      {/* Headline result */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-2 border-blue-300 dark:border-blue-800">
            <CardContent className="p-6">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Maximum Home Price You Can Afford</p>
              <p className="text-5xl font-bold text-blue-600 dark:text-blue-400 mt-1">{fmt(result.maxAffordableHomePrice)}</p>
              <p className="text-xs text-gray-500 mt-2">
                Estimated loan {fmt(result.estimatedLoanAmount)} at {form.interestRate}% for {form.termYears} years
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">P&amp;I</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white">{fmt(result.monthlyPrincipalInterest)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Taxes</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white">{fmt(result.monthlyTaxes)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Insurance</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white">{fmt(result.monthlyInsurance)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">PMI/MCL</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white">{fmt(result.mortgageInsurance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Debt-to-Income Ratio</p>
              <p className={`text-5xl font-bold mt-1 ${dti?.text}`}>{result.backEndDTI}%</p>
              <Badge variant={dti?.variant} className="mt-2">{dti?.label}</Badge>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-1 text-left text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Front-end (housing only)</span>
                  <span className="font-medium text-gray-900 dark:text-white">{result.frontEndDTI}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Today (bills + debts)</span>
                  <span className="font-medium text-gray-900 dark:text-white">{result.currentDTI}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DTI gauge */}
      {result && (
        <Card>
          <CardContent className="p-5">
            <CardTitle className="text-sm mb-3">DTI Guidelines</CardTitle>
            <div className="relative h-9 rounded-lg overflow-hidden flex">
              {[
                { label: '≤36% Ideal', w: '36%', cls: 'bg-emerald-500 text-white' },
                { label: '36–43% OK', w: '7%', cls: 'bg-green-500 text-white' },
                { label: '43–45% Max', w: '2%', cls: 'bg-yellow-500 text-black' },
                { label: '45–50% Risky', w: '5%', cls: 'bg-orange-500 text-white' },
                { label: '>50% Decline', w: '50%', cls: 'bg-red-500 text-white flex-1' },
              ].map((s, i) => (
                <div key={i} className={`${s.cls} flex items-center justify-center text-[10px] font-semibold`} style={{ width: s.w }}>
                  <span className="truncate px-1">{s.label}</span>
                </div>
              ))}
              <div
                className="absolute top-0 bottom-0 w-1 bg-gray-900 dark:bg-white"
                style={{ left: `${Math.min(result.backEndDTI, 100)}%` }}
                title={`Your DTI: ${result.backEndDTI}%`}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>0%</span><span>36%</span><span>43%</span><span>45%</span><span>50%</span><span>100%</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loan assumptions */}
        <Card className="lg:col-span-1">
          <CardContent className="p-5">
            <CardTitle className="text-sm mb-4 flex items-center gap-2">
              <Calculator className="w-4 h-4" /> Loan Assumptions
            </CardTitle>
            <div className="space-y-3">
              {field('Monthly Gross Income', 'monthlyGrossIncome', '1', '$')}
              {field('Other Monthly Income', 'monthlyOtherIncome', '1', '$')}
              {field('Down Payment', 'downPaymentPercent', '0.5', '', '%')}
              {field('Interest Rate', 'interestRate', '0.05', '', '%')}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Loan Term</label>
                <select
                  value={form.termYears}
                  onChange={e => setForm(f => ({ ...f, termYears: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value={30}>30 years</option>
                  <option value={20}>20 years</option>
                  <option value={15}>15 years</option>
                </select>
              </div>
              {field('Property Tax Rate', 'propertyTaxRate', '0.05', '', '%')}
              {field('Annual Home Insurance', 'annualHomeInsurance', '50', '$')}
              {field('Monthly HOA', 'monthlyHOA', '5', '$')}
              {field('Closing Costs', 'closingCostsPercent', '0.1', '', '%')}
              {field('Cash on Hand', 'cashOnHand', '100', '$')}
              {field('Reserves (months)', 'reservesMonths', '0.5')}
            </div>
          </CardContent>
        </Card>

        {/* Debt + expense editors */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <CardTitle className="text-sm">Monthly Debt Payments ({fmt(result?.totalMonthlyDebtPayments || 0)})</CardTitle>
                <Button variant="secondary" size="sm" onClick={() => setEditMode(editMode === 'debts' ? null : 'debts')}>
                  {editMode === 'debts' ? 'Done' : 'Adjust'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {debts.length === 0 && <p className="text-xs text-gray-400">No debts detected.</p>}
                {debts.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full px-2.5 py-1">
                    {d.label} · {fmt(d.payment)}
                    {editMode === 'debts' && (
                      <button onClick={() => setDebts(ds => ds.filter((_, j) => j !== i))} className="hover:text-red-900">×</button>
                    )}
                  </span>
                ))}
              </div>
              {editMode === 'debts' && (
                <button
                  onClick={() => setDebts(ds => [...ds, { label: 'New debt', payment: 0 }])}
                  className="mt-3 text-xs text-blue-600 hover:underline"
                >
                  + Add debt payment
                </button>
              )}
              {editMode === 'debts' && debts.length > 0 && (
                <div className="mt-3 space-y-2">
                  {debts.map((d, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={d.label}
                        onChange={e => setDebts(ds => ds.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                        className="flex-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                      />
                      <input
                        type="number"
                        value={d.payment}
                        onChange={e => setDebts(ds => ds.map((x, j) => j === i ? { ...x, payment: Number(e.target.value) || 0 } : x))}
                        className="w-28 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-right"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <CardTitle className="text-sm">Recurring Monthly Bills ({fmt(result?.totalRecurringExpenses || 0)})</CardTitle>
                <Badge variant="default">{expenses.length} bills</Badge>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {expenses.slice(0, 12).map((e, i) => (
                  <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-gray-700 dark:text-gray-300 truncate">{e.label}</span>
                    <span className="font-medium text-gray-900 dark:text-white tabular-nums">{fmt(e.amount)}</span>
                  </div>
                ))}
                {expenses.length > 12 && (
                  <p className="text-[10px] text-gray-400 pt-1">+{expenses.length - 12} more bills included in the total</p>
                )}
              </div>
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardContent className="p-5 space-y-3">
                <CardTitle className="text-sm">Monthly Cash Flow After This Home</CardTitle>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Gross Income</p>
                    <p className="font-bold text-gray-900 dark:text-white">{fmt(result.grossMonthlyIncome)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Housing</p>
                    <p className="font-bold text-red-600 dark:text-red-400">{fmt(result.totalMonthlyPayment)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Bills + Debts</p>
                    <p className="font-bold text-gray-900 dark:text-white">{fmt(result.totalRecurringExpenses + result.totalMonthlyDebtPayments)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Monthly Surplus</p>
                    <p className={`font-bold ${monthlySurplus >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                      {fmt(monthlySurplus)}
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Max Monthly Housing (45% cap)</p>
                    <p className="font-bold text-gray-900 dark:text-white">{fmt(result.monthlyHousingBudget45)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Cash Needed (down + closing + reserves)</p>
                    <p className={`font-bold ${result.shortOfCashBy > 0 ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {fmt(result.estimatedCashNeeded)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Notes + Georgia education */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {result && result.notes.length > 0 && (
          <Card>
            <CardContent className="p-5 space-y-2">
              <CardTitle className="text-sm mb-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" /> Analysis Notes
              </CardTitle>
              {result.notes.map((n, i) => (
                <p key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                  {n.startsWith('You are') || n.startsWith('DTI exceeds') || n.startsWith('Interest rate') ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  )}
                  {n}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-5 space-y-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Home className="w-4 h-4 text-emerald-500" /> Georgia Home-Buying Notes
            </CardTitle>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
              <li><strong>Georgia has no state income tax.</strong> That means more of your paycheck is available for a mortgage payment than in most states.</li>
              <li><strong>Property tax reassessment cap.</strong> If you occupy the home as your primary residence and claim the Georgia homestead exemption, the assessed value is frozen and cannot increase more than <strong>2% per year</strong>. Budget around 1–1.5% of purchase price annually.</li>
              <li><strong>Closing costs in Georgia run ~3%</strong> of the purchase price (attorney fees, transfer tax, recording, appraisal, title search, and survey are typically charged to the buyer).</li>
              <li><strong>Mortgage lending a law.</strong> Georgia lenders must give you a Loan Estimate within 3 business days of application. Review it before signing.</li>
              <li><strong>PMI (private mortgage insurance)</strong> is required by nearly all lenders when you put less than 20% down. Georgia allows <strong>Qualified Mortgage loans up to 95% LTV</strong> using FHA, VA, or USDA underwriting instead.</li>
              <li><strong>First-time buyer programs:</strong> GA Housing Finance Authority (GAHF) and Peach State Mortgage Allocation Program can provide down payment assistance.</li>
              <li><strong>MDN (Municipal Debt Nexus) bill</strong> passed in 2025, allowing counties to opt into homestead exemptions for new developments. Worth checking with your county.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
