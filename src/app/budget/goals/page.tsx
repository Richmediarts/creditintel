'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, TrendingDown, Target, DollarSign,
  Landmark, CreditCard, Wallet, PiggyBank, Receipt,
  CalendarCheck, ArrowUpDown, RotateCcw,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

interface BankAccount {
  id: number; name: string; account_type: string; current_balance: number; interest_rate: number
}
interface CreditCardAcc {
  id: number; name: string; current_balance: number; credit_limit: number; interest_rate: number
}
interface Stats {
  total_bank: number; total_credit: number; last_paycheck_net: number; monthly_expenses: number
}
interface DebtItem {
  id: string; name: string; type: string; balance: number; rate: number; minPmt: number
}

const LS_KEY = 'goalsPlan'
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
const fmtDec = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function loadGoals() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} } }
function saveGoals(d: Record<string, unknown>) { const e = loadGoals(); Object.assign(e, d); localStorage.setItem(LS_KEY, JSON.stringify(e)) }

function getMonthLabel(i: number) {
  const d = new Date(); d.setMonth(d.getMonth() + i)
  return d.toLocaleString('default', { month: 'short', year: 'numeric' })
}

export default function GoalsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [cards, setCards] = useState<CreditCardAcc[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  // Goals state
  const [monthlySavings, setMonthlySavings] = useState(0)
  const [extraDebtPayment, setExtraDebtPayment] = useState(0)
  const [debtPayments, setDebtPayments] = useState<Record<string, number>>({})
  const [avalanche, setAvalanche] = useState(true)

  // Utilization simulator
  const [targetUtil, setTargetUtil] = useState(30)
  const [utilExtraPmt, setUtilExtraPmt] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      const [acctRes, cardRes, statsRes] = await Promise.all([
        fetch('/api/budget/bank-accounts').catch(() => null),
        fetch('/api/budget/credit-cards').catch(() => null),
        fetch('/api/budget/stats').catch(() => null),
      ])
      if (acctRes?.ok) setAccounts((await acctRes.json()).accounts)
      if (cardRes?.ok) setCards((await cardRes.json()).cards)
      if (statsRes?.ok) setStats((await statsRes.json()).stats)
    } catch { /* ignore */ }
    const saved = loadGoals()
    if (saved.monthlySavings) setMonthlySavings(saved.monthlySavings)
    if (saved.extraDebtPayment) setExtraDebtPayment(saved.extraDebtPayment)
    if (saved.debtPayments) setDebtPayments(saved.debtPayments)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchData()
  }, [user, authLoading, fetchData])

  const persist = useCallback((key: string, val: unknown) => {
    saveGoals({ [key]: val })
  }, [])

  if (authLoading || !user || loading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
  }

  // Derived data
  const assetTypes = ['checking', 'savings', 'money_market', 'investment']
  const assetAccounts = accounts.filter(a => assetTypes.includes(a.account_type))
  const loanAccounts = accounts.filter(a => a.account_type === 'loan')
  const totalAssets = assetAccounts.reduce((s, a) => s + (a.current_balance || 0), 0)
  const totalCredit = cards.reduce((s, c) => s + (c.current_balance || 0), 0)
  const totalLoans = loanAccounts.reduce((s, a) => s + (a.current_balance || 0), 0)
  const totalDebt = totalLoans + totalCredit
  const netWorth = totalAssets - totalDebt
  const monthlyIncome = stats ? stats.last_paycheck_net * 26 / 12 : 0
  const monthlyBudget = stats?.monthly_expenses || 0
  const monthlySurplus = monthlyIncome - monthlyBudget
  const lastNet = stats?.last_paycheck_net || 0

  // Build debts
  const allDebts: DebtItem[] = [
    ...loanAccounts.map(a => ({ id: 'loan_' + a.id, name: a.name, type: 'Loan', balance: a.current_balance || 0, rate: 0, minPmt: debtPayments['loan_' + a.id] || 0 })),
    ...cards.map(c => ({ id: 'card_' + c.id, name: c.name, type: 'Credit Card', balance: c.current_balance || 0, rate: c.interest_rate || 0, minPmt: debtPayments['card_' + c.id] || 0 })),
  ].filter(d => d.balance > 0)

  // 6-Month Projection
  const startNW = netWorth
  const projectionRows: { month: string; startNW: number; income: number; expenses: number; debtPmt: number; savings: number; endNW: number; status: string }[] = []
  const debts = allDebts.map(d => ({ ...d }))
  let nw = startNW
  for (let m = 0; m < 6; m++) {
    const start = nw
    let debtPmt = 0
    const sorted = avalanche ? debts.slice().sort((a, b) => b.rate - a.rate) : debts.slice().sort((a, b) => a.balance - b.balance)
    let extraRem = extraDebtPayment
    for (const d of sorted) {
      if (d.balance <= 0) continue
      const min = d.minPmt
      let extra = 0
      if (extraRem > 0 && d.balance > min) { extra = Math.min(extraRem, d.balance - min); extraRem -= extra }
      const pmt = Math.min(min + extra, d.balance)
      debtPmt += pmt
      const interest = d.type === 'Credit Card' ? d.balance * (d.rate / 100 / 12) : 0
      d.balance = Math.max(0, d.balance - pmt + interest)
    }
    const sav = Math.min(monthlySavings, monthlyIncome - monthlyBudget - debtPmt)
    const end = start + monthlyIncome - monthlyBudget - debtPmt - Math.max(0, sav)
    const status = monthlyIncome - monthlyBudget - debtPmt - monthlySavings < 0 && m === 0 ? 'Deficit' : end > start ? 'Up' : end < start ? 'Down' : 'Flat'
    projectionRows.push({ month: getMonthLabel(m), startNW: start, income: monthlyIncome, expenses: monthlyBudget, debtPmt, savings: Math.max(0, sav), endNW: end, status })
    nw = end
  }

  // Credit utilization sim
  const totalLimit = cards.reduce((s, c) => s + (c.credit_limit || 0), 0)
  const totalBal = totalCredit
  const curUtil = totalLimit > 0 ? (totalBal / totalLimit * 100) : 0
  const targetBal = totalLimit * (targetUtil / 100)
  const needed = Math.max(0, totalBal - targetBal)
  const utilPayoffMonths = utilExtraPmt > 0 && needed > 0 ? Math.ceil(needed / utilExtraPmt) : needed <= 0 ? 0 : -1
  let scoreText = '—', scoreColor = 'text-gray-400'
  if (curUtil <= 10) { scoreText = 'Excellent'; scoreColor = 'text-green-500' }
  else if (needed <= 0) { scoreText = 'At target'; scoreColor = 'text-green-500' }
  else if (curUtil <= 30) { scoreText = 'Good'; scoreColor = 'text-yellow-500' }
  else if (curUtil <= 50) { scoreText = 'Fair'; scoreColor = 'text-yellow-500' }
  else { scoreText = 'Pay down ASAP'; scoreColor = 'text-red-500' }

  const utilCards = cards.filter(c => (c.credit_limit || 0) > 0).sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0))
  let remNeeded = needed
  const utilRows = utilCards.map(c => {
    const cBal = c.current_balance || 0
    const cLim = c.credit_limit || 0
    const cUtil = cLim > 0 ? (cBal / cLim * 100) : 0
    let pmt = 0
    if (remNeeded > 0 && cBal > 0) { pmt = Math.min(remNeeded, cBal); remNeeded -= pmt }
    const newBal = Math.max(0, cBal - pmt)
    const newUtil = cLim > 0 ? (newBal / cLim * 100) : 0
    return { name: c.name, balance: cBal, limit: cLim, util: cUtil, pmt, newBal, newUtil }
  })

  const resetGoals = () => {
    if (!confirm('Reset all goal targets to zero?')) return
    setMonthlySavings(0); setExtraDebtPayment(0); setDebtPayments({}); setTargetUtil(30); setUtilExtraPmt(0)
    localStorage.removeItem(LS_KEY)
  }

  const updateDebtPayment = (id: string, val: number) => {
    const next = { ...debtPayments, [id]: val }
    setDebtPayments(next)
    persist('debtPayments', next)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Financial Goals & Net Worth</h1>
          <p className="text-sm text-gray-500">Set monthly savings and debt payment goals. Adjust targets and the projection updates automatically.</p>
        </div>
        <Button onClick={resetGoals} variant="secondary" size="sm"><RotateCcw className="w-4 h-4 mr-1" /> Reset</Button>
      </div>

      {/* Row 1: Assets, Credit Debt, Loan Debt, Net Worth */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30"><Landmark className="w-5 h-5 text-green-600 dark:text-green-400" /></div>
            <div><p className="text-xs text-gray-400">Assets</p><p className="text-lg font-bold text-green-600 dark:text-green-400">{fmt(totalAssets)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30"><CreditCard className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
            <div><p className="text-xs text-gray-400">Credit Debt</p><p className="text-lg font-bold text-red-600 dark:text-red-400">{fmt(totalCredit)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30"><TrendingDown className="w-5 h-5 text-yellow-600 dark:text-yellow-400" /></div>
            <div><p className="text-xs text-gray-400">Loan Debt</p><p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{fmt(totalLoans)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${netWorth >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              <Target className={`w-5 h-5 ${netWorth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
            </div>
            <div><p className="text-xs text-gray-400">Net Worth</p><p className={`text-lg font-bold ${netWorth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(netWorth)}</p></div>
          </div>
        </CardContent></Card>
      </div>

      {/* Row 2: Monthly Income, Budget, Surplus, Paycheck */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30"><DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
            <div><p className="text-xs text-gray-400">Monthly Income</p><p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmt(monthlyIncome)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30"><Receipt className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
            <div><p className="text-xs text-gray-400">Monthly Budget</p><p className="text-lg font-bold text-red-600 dark:text-red-400">{fmt(monthlyBudget)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><PiggyBank className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
            <div><p className="text-xs text-gray-400">Monthly Surplus</p><p className={`text-lg font-bold ${monthlySurplus >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>{fmt(monthlySurplus)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30"><CalendarCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
            <div><p className="text-xs text-gray-400">Paycheck (Net)</p><p className="text-lg font-bold text-purple-500">{fmt(lastNet)}</p></div>
          </div>
        </CardContent></Card>
      </div>

      {/* 6-Month Projection */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="flex items-center gap-2 text-sm"><CalendarCheck className="w-4 h-4" /> 6-Month Projection</CardTitle>
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={avalanche} onChange={(e) => setAvalanche(e.target.checked)} className="rounded border-gray-300" />
              Avalanche (highest rate first)
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                  <th className="text-left py-2 px-2 font-medium">Month</th>
                  <th className="text-right py-2 px-2 font-medium">Start NW</th>
                  <th className="text-right py-2 px-2 font-medium">Income</th>
                  <th className="text-right py-2 px-2 font-medium">Expenses</th>
                  <th className="text-right py-2 px-2 font-medium">Debt Pmt</th>
                  <th className="text-right py-2 px-2 font-medium">Savings</th>
                  <th className="text-right py-2 px-2 font-medium">End NW</th>
                  <th className="text-right py-2 px-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {projectionRows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">{r.month}</td>
                    <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{fmt(r.startNW)}</td>
                    <td className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400">{fmt(r.income)}</td>
                    <td className="py-2 px-2 text-right text-red-500">{fmt(r.expenses)}</td>
                    <td className="py-2 px-2 text-right text-yellow-600 dark:text-yellow-400">{fmt(r.debtPmt)}</td>
                    <td className="py-2 px-2 text-right text-blue-600 dark:text-blue-400">{fmt(r.savings)}</td>
                    <td className={`py-2 px-2 text-right font-bold ${r.endNW >= r.startNW ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{fmt(r.endNW)}</td>
                    <td className="py-2 px-2 text-right">
                      {r.status === 'Deficit' && <span className="text-red-500 text-xs">Deficit</span>}
                      {r.status === 'Up' && <span className="text-green-500">↑</span>}
                      {r.status === 'Down' && <span className="text-red-500">↓</span>}
                      {r.status === 'Flat' && <span className="text-gray-400">→</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Debt Breakdown */}
      <Card>
        <CardContent className="p-5">
          <CardTitle className="flex items-center gap-2 mb-4 text-sm"><CreditCard className="w-4 h-4 text-red-500" /> Debt Breakdown</CardTitle>
          {allDebts.length === 0 ? (
            <p className="text-sm text-gray-400">No debt accounts found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                    <th className="text-left py-2 px-2 font-medium"><span className="flex items-center gap-1">Debt <ArrowUpDown className="w-3 h-3 opacity-40" /></span></th>
                    <th className="text-left py-2 px-2 font-medium">Type</th>
                    <th className="text-right py-2 px-2 font-medium">Balance</th>
                    <th className="text-right py-2 px-2 font-medium">Rate</th>
                    <th className="text-right py-2 px-2 font-medium">Monthly Pmt</th>
                    <th className="text-right py-2 px-2 font-medium">Interest/Mo</th>
                    <th className="text-right py-2 px-2 font-medium">6mo Payoff</th>
                  </tr>
                </thead>
                <tbody>
                  {allDebts.map(d => {
                    const monthlyInterest = d.rate > 0 ? d.balance * (d.rate / 100 / 12) : 0
                    const eff = d.minPmt - monthlyInterest
                    const payoffMonths = d.minPmt > 0 && d.balance > 0 && eff > 0 ? Math.ceil(d.balance / eff) : d.balance <= 0 ? 0 : -1
                    return (
                      <tr key={d.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">{d.name}</td>
                        <td className="py-2 px-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${d.type === 'Loan' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{d.type}</span>
                        </td>
                        <td className="py-2 px-2 text-right text-red-600 dark:text-red-400 font-medium">{fmtDec(d.balance)}</td>
                        <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{d.rate > 0 ? `${d.rate}%` : '—'}</td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number" min="0" step="50"
                            value={d.minPmt}
                            onChange={(e) => updateDebtPayment(d.id, parseFloat(e.target.value) || 0)}
                            className="w-20 sm:w-24 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-right text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{fmt(monthlyInterest)}</td>
                        <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">
                          {payoffMonths === 0 ? <span className="text-green-500">Paid ✓</span> : payoffMonths > 0 ? `${payoffMonths}mo${payoffMonths > 6 ? ' ⚠' : ' ✓'}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Savings Goals */}
      <Card>
        <CardContent className="p-5">
          <CardTitle className="flex items-center gap-2 mb-4 text-sm"><PiggyBank className="w-4 h-4" /> Savings Goals</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Monthly Savings Target</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="100" value={monthlySavings}
                  onChange={(e) => { const v = parseFloat(e.target.value) || 0; setMonthlySavings(v); persist('monthlySavings', v) }}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-7 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Extra Monthly Debt Payment</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="100" value={extraDebtPayment}
                  onChange={(e) => { const v = parseFloat(e.target.value) || 0; setExtraDebtPayment(v); persist('extraDebtPayment', v) }}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-7 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Savings Account</label>
              <select className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Select Account —</option>
                {accounts.filter(a => ['savings', 'money_market'].includes(a.account_type)).map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({fmt(a.current_balance)})</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Utilization Simulator */}
      <Card>
        <CardContent className="p-5">
          <CardTitle className="flex items-center gap-2 mb-4 text-sm"><TrendingDown className="w-4 h-4 text-red-500" /> Credit Utilization Simulator</CardTitle>

          {/* Stats row */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
            <div className="text-center p-2 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-[10px] text-gray-400">Total Limit</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(totalLimit)}</p>
            </div>
            <div className="text-center p-2 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-[10px] text-gray-400">Total Balance</p>
              <p className="text-sm font-bold text-red-500">{fmt(totalBal)}</p>
            </div>
            <div className="text-center p-2 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-[10px] text-gray-400">Utilization</p>
              <p className={`text-sm font-bold ${curUtil > 50 ? 'text-red-500' : curUtil > 30 ? 'text-yellow-500' : 'text-green-500'}`}>{curUtil.toFixed(1)}%</p>
            </div>
            <div className="text-center p-2 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-[10px] text-gray-400">To Pay for Target</p>
              <p className={`text-sm font-bold ${needed > 0 ? 'text-red-500' : 'text-green-500'}`}>{fmt(needed)}</p>
            </div>
            <div className="text-center p-2 rounded-lg border border-gray-200 dark:border-gray-700 col-span-3 sm:col-span-1">
              <p className="text-[10px] text-gray-400">Score Impact</p>
              <p className={`text-sm font-bold ${scoreColor}`}>{scoreText}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Target Utilization Rate</label>
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="100" value={targetUtil}
                  onChange={(e) => setTargetUtil(parseInt(e.target.value))}
                  className="flex-1 h-2 rounded-lg appearance-none bg-gray-200 dark:bg-gray-700 accent-blue-600"
                />
                <span className={`text-xs font-bold px-2 py-1 rounded min-w-[48px] text-center ${targetUtil <= 10 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : targetUtil <= 30 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>{targetUtil}%</span>
              </div>
              <div className="flex gap-1 mt-2">
                {[0, 10, 30, 50].map(v => (
                  <button key={v} onClick={() => setTargetUtil(v)} className={`px-2 py-1 text-xs rounded border transition-colors ${targetUtil === v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-500'}`}>{v}%</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Extra Monthly Payment</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="50" value={utilExtraPmt}
                  onChange={(e) => setUtilExtraPmt(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-7 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Target Payoff</label>
              <p className={`text-lg font-bold mt-1 ${utilPayoffMonths === 0 ? 'text-green-500' : utilPayoffMonths > 0 && utilPayoffMonths <= 6 ? 'text-blue-500' : utilPayoffMonths > 6 ? 'text-yellow-500' : 'text-gray-400'}`}>
                {utilPayoffMonths === 0 ? '✓ At target' : utilPayoffMonths > 0 ? `${utilPayoffMonths}mo` : '—'}
              </p>
            </div>
          </div>

          {/* Per-card table */}
          {utilRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                    <th className="text-left py-2 px-2 font-medium">Card</th>
                    <th className="text-right py-2 px-2 font-medium">Balance</th>
                    <th className="text-right py-2 px-2 font-medium">Limit</th>
                    <th className="text-right py-2 px-2 font-medium">Utilization</th>
                    <th className="text-right py-2 px-2 font-medium">Extra Pmt</th>
                    <th className="text-right py-2 px-2 font-medium">New Balance</th>
                    <th className="text-right py-2 px-2 font-medium">New Util</th>
                  </tr>
                </thead>
                <tbody>
                  {utilRows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">{r.name}</td>
                      <td className="py-2 px-2 text-right">{fmt(r.balance)}</td>
                      <td className="py-2 px-2 text-right">{fmt(r.limit)}</td>
                      <td className={`py-2 px-2 text-right font-medium ${r.util > 50 ? 'text-red-500' : r.util > 30 ? 'text-yellow-500' : 'text-green-500'}`}>{r.util.toFixed(1)}%</td>
                      <td className="py-2 px-2 text-right text-green-600 dark:text-green-400">{fmt(r.pmt)}</td>
                      <td className="py-2 px-2 text-right">{fmt(r.newBal)}</td>
                      <td className={`py-2 px-2 text-right font-medium ${r.newUtil > 50 ? 'text-red-500' : r.newUtil > 30 ? 'text-yellow-500' : 'text-green-500'}`}>{r.newUtil.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
