'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, ArrowLeft, CalendarDays, CheckCircle2, Clock, ChevronDown, ChevronUp, Tags, Receipt, RefreshCw, Loader2 } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { prettyCategory, categoryColor } from '@/lib/plaid-categories'

interface BudgetBill {
  id: number
  payee_name?: string
  amount: number
  due_date: string
  is_paid: number
  paid_date?: string
}

interface PeriodData {
  income: number
  expenses: number
  dueExpenses: number
  bills: BudgetBill[]
  periodBegin: string
  periodEnd: string
}

interface PayPeriodHistory {
  periods: Record<string, PeriodData>
}

interface PaycheckOption {
  id: number
  check_date?: string
  net_pay?: number
  pay_period_begin?: string
  pay_period_end?: string
}

const fmt = (n: unknown): string =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function shortTxDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso || '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(-2)}`
}

interface TxRow {
  id: number
  account_id: number
  account_name: string
  account_kind: 'bank' | 'credit'
  date: string
  description: string
  amount: number
  category: string | null
  category_detail: string | null
}

interface CatSpend {
  category: string
  count: number
  spend: number
}

interface TxPayload {
  transactions: TxRow[]
  byCategory: CatSpend[]
  categories: string[]
}

const RANGE_OPTIONS = [30, 60, 90] as const

export default function PayPeriodReportsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<PayPeriodHistory | null>(null)
  const [paychecks, setPaychecks] = useState<PaycheckOption[]>([])
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<'weekly' | 'biweekly' | 'monthly'>('biweekly')
  const [selectedPaycheck, setSelectedPaycheck] = useState<string>('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [txData, setTxData] = useState<TxPayload | null>(null)
  const [txLoading, setTxLoading] = useState(true)
  const [txSyncing, setTxSyncing] = useState(false)
  const [txMsg, setTxMsg] = useState('')
  const [txErr, setTxErr] = useState('')
  const [rangeDays, setRangeDays] = useState<number>(90)
  const [selCategory, setSelCategory] = useState('')
  const [selKind, setSelKind] = useState('')
  const [txTableLimit, setTxTableLimit] = useState(50)

  const findBackfill = useCallback(async () => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - rangeDays)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const qs = new URLSearchParams({ start_date: iso(start), end_date: iso(end), limit: '2000' })
    if (selCategory) qs.set('category', selCategory)
    if (selKind) qs.set('account_kind', selKind)
    const res = await fetch(`/api/budget/transactions?${qs}`)
    if (res.ok) setTxData(await res.json())
  }, [rangeDays, selCategory, selKind])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        await findBackfill()
      } catch { /* ignore */ }
      if (!cancelled) setTxLoading(false)
    })()
    return () => { cancelled = true }
  }, [user, findBackfill])

  const runTransactionSync = async () => {
    setTxSyncing(true)
    setTxErr('')
    setTxMsg('')
    try {
      const res = await fetch('/api/budget/plaid/sync-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full: true }),
      })
      const data = await res.json()
      if (res.ok) {
        setTxMsg(data.message || 'Transactions synced')
      } else {
        setTxErr(data.error || 'Transaction sync failed')
      }
      await findBackfill()
      setTxLoading(false)
    } catch {
      setTxErr('Transaction sync failed')
    } finally {
      setTxSyncing(false)
    }
  }

  const fetchData = useCallback(async (g: string) => {
    setLoading(true)
    const res = await fetch(`/api/budget/pay-period-history?group=${g}`)
    if (res.ok) {
      const json = await res.json()
      setData(json)
    }
    setLoading(false)
  }, [])

  const fetchPaychecks = useCallback(async () => {
    const res = await fetch('/api/budget/paychecks')
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json.paychecks)) setPaychecks(json.paychecks)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) { fetchData(group); fetchPaychecks() }
  }, [user, authLoading, fetchData, fetchPaychecks, group])

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const periods = data?.periods || {}
  const keys = Object.keys(periods)
  const sortedKeys = [...keys].sort((a, b) => (a < b ? 1 : -1))

  // When a specific paycheck is chosen, keep only the period window that
  // contains that paycheck's check date (income + bills for that period).
  const visibleKeys = selectedPaycheck
    ? sortedKeys.filter((key) => {
        const p = periods[key]
        const pc = selectedPaycheck
        if (group === 'biweekly') return key === pc
        return p.periodBegin <= pc && pc <= p.periodEnd
      })
    : sortedKeys

  // When a single paycheck is selected, auto-expand its period rows.
  useEffect(() => {
    if (!selectedPaycheck) return
    setExpanded(new Set(visibleKeys))
  }, [selectedPaycheck, group, data])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  const chartData = visibleKeys.map((key) => {
    const p = periods[key]
    const net = p.income - p.expenses
    return {
      period: shortDate(key) + '\n' + shortDate(p.periodEnd),
      income: Number(p.income || 0).toFixed(2),
      'Bills Paid': Number(p.expenses || 0).toFixed(2),
      'Bills Due': Number(p.dueExpenses || 0).toFixed(2),
      net: Number(net || 0).toFixed(2),
    }
  })

  const chartColors = { income: '#3b82f6', paid: '#16a34a', due: '#f59e0b' }

  const txs = txData?.transactions || []
  const byCat = txData?.byCategory || []
  const cats = txData?.categories || []
  const totalSpend = byCat.reduce((s, c) => s + Number(c.spend || 0), 0)
  const totalIncome = txs.filter((t) => t.amount > 0).reduce((s, t) => s + Number(t.amount || 0), 0)
  const maxCat = totalSpend > 0 ? Math.max(...byCat.map((c) => Number(c.spend || 0)), 0) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Pay Period Reports
          </h1>
          <p className="text-sm text-gray-500">Income vs. paid expenses breakdown for each pay period.</p>
        </div>
        <Link href="/budget">
          <Button variant="secondary" size="sm"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard</Button>
        </Link>
      </div>

      {/* Grouping + paycheck filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 p-1 w-fit">
          {(['weekly', 'biweekly', 'monthly'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                group === g
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          Paycheck:
          <select
            value={selectedPaycheck}
            onChange={(e) => setSelectedPaycheck(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Paychecks</option>
            {paychecks.map((pc) => (
              <option key={pc.id} value={pc.check_date || ''}>
                {shortDate(pc.check_date || '')} — {fmt(pc.net_pay)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visibleKeys.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarDays className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No pay period data available for the selected filter. Try a different paycheck or grouping.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Chart */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="text-sm">Income vs. Expenses</CardTitle>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Income</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Bills Paid</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Bills Due</span>
                </div>
              </div>
              <div className="h-80 -mx-1">
                <ResponsiveContainer width="100%" height="100%" minHeight={320}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#64748b33" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#64748b" />
                    <YAxis tickFormatter={(v) => `$${Number(v)}`} tick={{ fontSize: 12 }} stroke="#64748b" width={70} />
                    <Tooltip
                      formatter={(value) => fmt(value)}
                      contentStyle={{
                        background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12, color: '#fff',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="income" fill={chartColors.income} radius={[4, 4, 0, 0]} maxBarSize={42} />
                    <Bar dataKey="Bills Paid" fill={chartColors.paid} radius={[4, 4, 0, 0]} maxBarSize={42} />
                    <Bar dataKey="Bills Due" fill={chartColors.due} radius={[4, 4, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Income', value: visibleKeys.reduce((s, k) => s + (Number(periods[k].income) || 0), 0), color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Total Bills Paid', value: visibleKeys.reduce((s, k) => s + (Number(periods[k].expenses) || 0), 0), color: 'text-green-600 dark:text-green-400' },
              { label: 'Total Bills Due (Unpaid)', value: visibleKeys.reduce((s, k) => s + (Number(periods[k].dueExpenses) || 0), 0), color: 'text-amber-600 dark:text-amber-400' },
              { label: 'Total Net Difference', value: visibleKeys.reduce((s, k) => s + (Number(periods[k].income) || 0) - (Number(periods[k].expenses) || 0), 0), color: '' },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-3 sm:p-5">
                  <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">{s.label}</p>
                  <p className={`text-lg sm:text-2xl font-bold mt-1 truncate ${s.color || (Number(s.value) >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500')}`}>{fmt(s.value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Period breakdown */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <CardTitle className="text-sm">Pay Period Summary</CardTitle>
                <Badge variant="info">{visibleKeys.length} Period{visibleKeys.length !== 1 ? 's' : ''}</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-3">Pay Period</th>
                      <th className="py-2 pr-3 text-right">Income (Net)</th>
                      <th className="py-2 pr-3 text-right">Bills Paid</th>
                      <th className="py-2 pr-3 text-right">Bills Due</th>
                      <th className="py-2 text-right">Net Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleKeys.map((key) => {
                      const p = periods[key]
                      const net = p.income - p.expenses
                      const countPaid = p.bills?.filter((b) => b.is_paid).length || 0
                      const countDue = p.bills?.filter((b) => !b.is_paid).length || 0
                      const isOpen = expanded.has(key)
                      return (
                        <React.Fragment key={key}>
                          <tr className={`border-b border-gray-100 dark:border-gray-800 ${isOpen ? 'bg-gray-50 dark:bg-gray-800/40' : ''} cursor-pointer`} onClick={() => toggleExpanded(key)}>
                            <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">
                              <span className="inline-flex items-center gap-1">
                                {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                                <span className="flex flex-col">
                                  <span>{shortDate(key)}</span>
                                  <span className="text-xs font-normal text-gray-400">Pay period {shortDate(p.periodBegin)} – {shortDate(p.periodEnd)}</span>
                                </span>
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{fmt(p.income)}</td>
                            <td className="py-2 pr-3 text-right text-green-600 dark:text-green-400">{fmt(p.expenses)} <span className="text-xs text-gray-400">({countPaid})</span></td>
                            <td className="py-2 pr-3 text-right text-amber-600 dark:text-amber-400">{fmt(p.dueExpenses)} <span className="text-xs text-gray-400">({countDue})</span></td>
                            <td className={`py-2 text-right font-semibold ${net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                              {net >= 0 ? '+' : ''}{fmt(net)}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="border-b border-gray-100 dark:border-gray-800">
                              <td colSpan={5} className="py-3 pl-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {p.bills && p.bills.length > 0 ? (
                                    p.bills.map((b) => (
                                      <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {b.is_paid ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                          ) : (
                                            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                                          )}
                                          <div className="min-w-0">
                                            <Link
                                              href={`/budget/bills?bill=${b.id}`}
                                              className="inline-block max-w-full text-gray-800 dark:text-gray-200 truncate hover:text-blue-600 dark:hover:text-blue-400"
                                              title="Open bill to mark paid or edit"
                                            >
                                              {b.payee_name || 'Bill'}
                                            </Link>
                                            <p className={`text-xs ${b.is_paid ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                              {b.is_paid ? 'Paid' : 'Due'} · {shortDate(b.due_date)}{b.paid_date ? ` (paid ${shortDate(b.paid_date)})` : ''}
                                            </p>
                                          </div>
                                        </div>
                                        <span className={`font-medium truncate ${b.is_paid ? 'text-gray-900 dark:text-white' : 'text-amber-600 dark:text-amber-400'}`}>{fmt(b.amount)}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-sm text-gray-400 col-span-2">No bills in this pay period.</p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Bills Paid shows bills marked as paid within the period; Net Difference = Income − Bills Paid.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Transactions by Category */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <CardTitle>
                Transactions by Category
                <span className="block text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">
                  Spend from linked bank accounts and credit cards
                </span>
              </CardTitle>
            </div>
            <Button onClick={runTransactionSync} disabled={txSyncing} variant="secondary" size="sm">
              {txSyncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              {txSyncing ? 'Syncing…' : 'Sync Last 90 Days'}
            </Button>
          </div>

          {txMsg && (
            <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              {txMsg}
            </div>
          )}
          {txErr && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {txErr}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 p-1 w-fit">
              {RANGE_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => { setRangeDays(d); setTxTableLimit(50) }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    rangeDays === d
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {d} days
                </button>
              ))}
            </div>
            <select
              value={selCategory}
              onChange={(e) => { setSelCategory(e.target.value); setTxTableLimit(50) }}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Categories</option>
              {cats.map((c) => (
                <option key={c} value={c}>{prettyCategory(c)}</option>
              ))}
            </select>
            <select
              value={selKind}
              onChange={(e) => { setSelKind(e.target.value); setTxTableLimit(50) }}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Accounts</option>
              <option value="bank">Bank Accounts</option>
              <option value="credit">Credit Cards</option>
            </select>
          </div>

          {txLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : txs.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No synced transactions in this range yet. Link accounts via Plaid on the Bank Accounts or Credit Cards page, then hit &quot;Sync Last 90 Days&quot;.
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 p-3">
                  <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">Total Spend (90d)</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{fmt(totalSpend)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 p-3">
                  <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">Money In</p>
                  <p className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">{fmt(totalIncome)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 p-3">
                  <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">Transactions</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{txs.length}</p>
                </div>
              </div>

              {/* Category breakdown */}
              {byCat.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Spending breakdown</p>
                  <div className="space-y-2.5">
                    {byCat.map((c) => {
                      const label = prettyCategory(c.category)
                      const color = categoryColor(label)
                      const pct = totalSpend > 0 ? (Number(c.spend) / totalSpend) * 100 : 0
                      return (
                        <div key={c.category} className="flex items-center gap-3">
                          <span
                            className="w-28 shrink-0 text-xs text-gray-600 dark:text-gray-400 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                            onClick={() => { setSelCategory(selCategory === c.category ? '' : c.category); setTxTableLimit(50) }}
                            title={`Filter to ${label}`}
                          >
                            <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: color }} />
                            {label}
                          </span>
                          <div className="flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${maxCat > 0 ? (Number(c.spend) / maxCat) * 100 : 0}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-white">{fmt(c.spend)}</span>
                          <span className="w-8 shrink-0 text-right text-[11px] text-gray-400">{Math.round(pct)}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Transactions table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Description</th>
                      <th className="py-2 pr-3">Account</th>
                      <th className="py-2 pr-3">Category</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.slice(0, txTableLimit).map((tx) => {
                      const label = prettyCategory(tx.category)
                      const color = categoryColor(label)
                      return (
                        <tr key={tx.id} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 pr-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{shortTxDate(tx.date)}</td>
                          <td className="py-2 pr-3 max-w-[240px] truncate text-gray-900 dark:text-white" title={tx.description}>{tx.description || '—'}</td>
                          <td className="py-2 pr-3 max-w-[160px] truncate text-gray-500 dark:text-gray-400" title={tx.account_name || ''}>
                            {tx.account_name || (tx.account_kind === 'credit' ? 'Credit Card' : 'Bank Account')}
                          </td>
                          <td className="py-2 pr-3">
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                              {label}
                            </span>
                          </td>
                          <td className={`py-2 text-right font-semibold tabular-nums whitespace-nowrap ${tx.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {fmt(tx.amount)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {txs.length > txTableLimit && (
                  <div className="flex justify-center mt-3">
                    <Button variant="secondary" size="sm" onClick={() => setTxTableLimit((n) => n + 100)}>
                      Show {Math.min(100, txs.length - txTableLimit)} more of {txs.length} ({txs.length - txTableLimit} remain)
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}