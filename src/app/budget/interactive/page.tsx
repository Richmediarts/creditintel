'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, RotateCcw, Printer, Wallet, Info,
  CheckCircle2, AlertTriangle, ChevronDown, Target,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { BUCKETS, categorize, TEMPLATE, computeStatus, budgetVerdict, type Bucket } from '@/lib/utils/budgetRule'

interface LineItem {
  id: string
  label: string
  amount: number
}

interface Bill {
  id: number
  payee_name?: string
  amount: number
  due_date: string
  is_paid: number
}

interface Stats {
  biweekly_income: number
  last_paycheck_net: number
}

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtRound = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { maximumFractionDigits: 0 })

const LS_KEY = 'interactiveBudget502030'

function genId(): string {
  return Math.random().toString(36).slice(2, 11)
}

interface Worksheet {
  monthlyIncome: number
  items: Record<Bucket, LineItem[]>
}

function buildDefault(income: number): Worksheet {
  const mk = (bucket: Bucket): LineItem[] =>
    TEMPLATE[bucket].map(label => ({ id: genId(), label, amount: 0 }))
  return {
    monthlyIncome: Math.round((Number(income) || 0)),
    items: { needs: mk('needs'), wants: mk('wants'), savings: mk('savings') },
  }
}

function loadState(): Worksheet | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Worksheet
    if (!parsed || !parsed.items) return null
    // Ensure all buckets exist even if stored data predates a bucket.
    for (const b of BUCKETS) {
      if (!Array.isArray(parsed.items[b.key])) parsed.items[b.key] = []
    }
    return parsed
  } catch {
    return null
  }
}

function saveState(ws: Worksheet): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ws))
  } catch { /* quota */ }
}

export default function InteractiveBudgetPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [ws, setWs] = useState<Worksheet | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [openBuckets, setOpenBuckets] = useState<Set<Bucket>>(new Set(['needs']))
  const [showBills, setShowBills] = useState<Bucket | null>(null)

  const fetchData = useCallback(async () => {
    let income = 2000
    try {
      const [statsRes, billsRes] = await Promise.all([
        fetch('/api/budget/stats').catch(() => null),
        fetch('/api/budget/bills').catch(() => null),
      ])
      if (statsRes?.ok) {
        const d = await statsRes.json()
        setStats(d.stats)
        income = d.stats?.biweekly_income || 2000
      }
      if (billsRes?.ok) {
        const d = await billsRes.json()
        setBills(d.bills || [])
      }
    } catch { /* continue with defaults */ }

    // A biweekly paycheck annualized to a month.
    const monthly = Math.round((Number(income) || 0) * 12 / 26)

    const saved = loadState()
    if (saved) {
      setWs(saved)
    } else {
      setWs(buildDefault(monthly))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchData()
  }, [user, authLoading, fetchData])

  const persist = useCallback((next: Worksheet) => {
    setWs(next)
    saveState(next)
  }, [])

  const updateItem = useCallback((bucket: Bucket, id: string, field: 'label' | 'amount', val: string) => {
    setWs(prev => {
      if (!prev) return prev
      const next: Worksheet = {
        ...prev,
        items: {
          ...prev.items,
          [bucket]: prev.items[bucket].map(i =>
            i.id === id
              ? { ...i, [field]: field === 'amount' ? (parseFloat(val) || 0) : val }
              : i
          ),
        },
      }
      saveState(next)
      return next
    })
  }, [])

  const addItem = useCallback((bucket: Bucket) => {
    setWs(prev => {
      if (!prev) return prev
      const next: Worksheet = {
        ...prev,
        items: {
          ...prev.items,
          [bucket]: [...prev.items[bucket], { id: genId(), label: 'New item', amount: 0 }],
        },
      }
      saveState(next)
      return next
    })
  }, [])

  const deleteItem = useCallback((bucket: Bucket, id: string) => {
    setWs(prev => {
      if (!prev) return prev
      const next: Worksheet = {
        ...prev,
        items: { ...prev.items, [bucket]: prev.items[bucket].filter(i => i.id !== id) },
      }
      saveState(next)
      return next
    })
  }, [])

  /** Pull an unpaid bill into a bucket, auto-categorized from its payee name. */
  const addBill = useCallback((bill: Bill, bucket: Bucket) => {
    setWs(prev => {
      if (!prev) return prev
      const label = bill.payee_name || 'Unknown payee'
      if (prev.items[bucket].some(i => i.label.toLowerCase() === label.toLowerCase())) return prev
      const next: Worksheet = {
        ...prev,
        items: {
          ...prev.items,
          [bucket]: [...prev.items[bucket], { id: genId(), label, amount: bill.amount || 0 }],
        },
      }
      saveState(next)
      return next
    })
    setShowBills(null)
  }, [])

  const addAllBills = useCallback((bucket: Bucket) => {
    setWs(prev => {
      if (!prev) return prev
      const existing = new Set(prev.items[bucket].map(i => i.label.toLowerCase()))
      const additions = bills
        .filter(b => !existing.has((b.payee_name || 'unknown payee').toLowerCase()))
        .map(b => ({ id: genId(), label: b.payee_name || 'Unknown payee', amount: b.amount || 0 }))
      if (additions.length === 0) return prev
      const next: Worksheet = {
        ...prev,
        items: { ...prev.items, [bucket]: [...prev.items[bucket], ...additions] },
      }
      saveState(next)
      return next
    })
    setShowBills(null)
  }, [bills])

  const resetToDefault = useCallback(() => {
    if (!confirm('Reset to a blank 50/30/20 worksheet? Your current numbers will be lost.')) return
    localStorage.removeItem(LS_KEY)
    setWs(buildDefault(ws?.monthlyIncome || 2000))
  }, [ws])

  const toggleBucket = (bucket: Bucket) => {
    setOpenBuckets(prev => {
      const next = new Set(prev)
      if (next.has(bucket)) next.delete(bucket)
      else next.add(bucket)
      return next
    })
  }

  const totals = useMemo(() => {
    const t: Record<Bucket, number> = { needs: 0, wants: 0, savings: 0 }
    if (!ws) return t
    for (const b of BUCKETS) {
      t[b.key] = ws.items[b.key].reduce((s, i) => s + (Number(i.amount) || 0), 0)
    }
    return t
  }, [ws])

  const statuses = useMemo(
    () => computeStatus(ws?.monthlyIncome || 0, totals),
    [ws, totals]
  )

  const totalAllocated = useMemo(
    () => BUCKETS.reduce((s, b) => s + (totals[b.key] || 0), 0),
    [totals]
  )

  const remaining = (ws?.monthlyIncome || 0) - totalAllocated
  const verdict = useMemo(() => budgetVerdict(ws?.monthlyIncome || 0, totals), [ws, totals])

  if (loading || !ws) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  const barColorFor = (ratio: number, over: boolean) => {
    if (over) return 'bg-red-500'
    if (ratio >= 0.8) return 'bg-emerald-500'
    if (ratio >= 0.5) return 'bg-amber-500'
    return 'bg-amber-400'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Budget Calculator</h1>
            <p className="text-sm text-gray-500">The 50/30/20 rule applied to your take-home pay</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} variant="secondary" size="sm">
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button onClick={resetToDefault} variant="secondary" size="sm">
            <RotateCcw className="w-4 h-4 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {/* Income + summary */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                Monthly take-home pay
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">$</span>
                <input
                  type="number"
                  step="50"
                  value={ws.monthlyIncome}
                  onChange={e => persist({ ...ws, monthlyIncome: Number(e.target.value) || 0 })}
                  onFocus={e => e.target.select()}
                  className="w-full pl-9 pr-3 py-2 text-3xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-200 dark:border-blue-900 focus:outline-none focus:border-blue-500 tabular-nums"
                />
              </div>
              {stats && stats.biweekly_income > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  From your biweekly paycheck ({fmtRound(stats.biweekly_income)} × 26 ÷ 12)
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Total allocated</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{fmt(totalAllocated)}</p>
              <p className="text-[11px] text-gray-400 mt-1">
                {ws.monthlyIncome > 0
                  ? `${((totalAllocated / ws.monthlyIncome) * 100).toFixed(0)}% of income`
                  : 'Enter income to see the percentage'}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                {remaining >= 0 ? 'Left to allocate' : 'Over budget by'}
              </p>
              <p className={`text-3xl font-bold tabular-nums ${remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {fmt(Math.abs(remaining))}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {remaining >= 0 ? 'Unassigned income' : 'Income does not cover these numbers'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verdict */}
      <Card
        className={
          verdict.tone === 'good'
            ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
            : verdict.tone === 'bad'
              ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
              : 'border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
        }
      >
        <CardContent className="p-4 flex items-start gap-3">
          {verdict.tone === 'good'
            ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            : <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{verdict.title}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{verdict.detail}</p>
          </div>
        </CardContent>
      </Card>

      {/* Allocation bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Where your income goes</p>
            <p className="text-[11px] text-gray-400">Bar width is each bucket's share of your income</p>
          </div>
          <div className="flex h-8 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
            {statuses.map(s => {
              const w = Math.min(s.percentOfIncome, 100)
              if (w <= 0) return null
              const cls = s.key === 'needs' ? 'bg-blue-500' : s.key === 'wants' ? 'bg-amber-500' : 'bg-emerald-500'
              return (
                <div
                  key={s.key}
                  className={`${cls} flex items-center justify-center text-[10px] font-semibold text-white min-w-0`}
                  style={{ width: `${w}%` }}
                  title={`${s.key}: ${fmt(s.actual)} (${s.percentOfIncome.toFixed(0)}%)`}
                >
                  {w > 8 ? `${s.percentOfIncome.toFixed(0)}%` : ''}
                </div>
              )
            })}
            {ws.monthlyIncome > totalAllocated && (
              <div
                className="bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-semibold text-gray-500 dark:text-gray-400"
                style={{ width: `${Math.max(0, ((ws.monthlyIncome - totalAllocated) / ws.monthlyIncome) * 100)}%` }}
              >
                Unassigned
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {statuses.map(s => {
              const cls = s.key === 'needs' ? 'bg-blue-500' : s.key === 'wants' ? 'bg-amber-500' : 'bg-emerald-500'
              return (
                <span key={s.key} className="text-[11px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${cls}`} />
                  {s.key === 'savings' ? 'Savings & Debt' : s.key.charAt(0).toUpperCase() + s.key.slice(1)} {fmt(s.actual)}
                </span>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Three buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {statuses.map(status => {
          const def = BUCKETS.find(b => b.key === status.key)!
          const items = ws.items[status.key]
          const isOpen = openBuckets.has(status.key)
          const barColor = barColorFor(status.ratio, status.overBy)

          return (
            <Card key={status.key} className="flex flex-col">
              {/* Bucket header */}
              <button
                onClick={() => toggleBucket(status.key)}
                className="w-full text-left p-5 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">{def.title}</h2>
                      <span className={`text-sm font-bold ${def.textColor}`}>{def.percent}%</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">Target {fmt(status.target)}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform mt-1 ${isOpen ? 'rotate-180' : ''}`} />
                </div>

                <p className={`text-2xl font-bold mt-2 tabular-nums ${def.textColor}`}>{fmt(status.actual)}</p>

                {/* Target comparison bar */}
                <div className="mt-3">
                  <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(status.ratio * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className={status.diff < 0 ? 'text-red-500 font-medium' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
                      {status.diff < 0
                        ? `${fmt(Math.abs(status.diff))} over`
                        : `${fmt(status.diff)} under`}
                    </span>
                    <span className="text-gray-400">{status.percentOfIncome.toFixed(0)}% of income</span>
                  </div>
                </div>
              </button>

              {/* Bucket body */}
              {isOpen && (
                <CardContent className="p-4 flex-1 flex flex-col">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                    {def.description}
                  </p>

                  <div className="space-y-1.5 flex-1">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center gap-1.5 group">
                        <input
                          type="text"
                          value={item.label}
                          onChange={e => updateItem(status.key, item.id, 'label', e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const el = (e.target as HTMLInputElement).closest('.group')?.querySelector('input[type="number"]') as HTMLInputElement | null
                              el?.focus()
                              el?.select()
                            }
                          }}
                          className="flex-1 min-w-0 bg-transparent border-none text-sm text-gray-900 dark:text-white focus:outline-none p-0 truncate"
                        />
                        <span className="text-gray-300 text-sm">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={item.amount}
                          onChange={e => updateItem(status.key, item.id, 'amount', e.target.value)}
                          onFocus={e => e.target.select()}
                          className="w-24 bg-transparent border-b border-transparent focus:border-blue-500 text-sm text-right tabular-nums text-gray-900 dark:text-white focus:outline-none p-0"
                        />
                        <button
                          onClick={() => deleteItem(status.key, item.id)}
                          className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                    <button
                      onClick={() => addItem(status.key)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add item
                    </button>
                    {bills.length > 0 && (
                      <>
                        <button
                          onClick={() => setShowBills(showBills === status.key ? null : status.key)}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:underline block"
                        >
                          Pull from your unpaid bills ({bills.filter(b => !b.is_paid).length}) ▾
                        </button>
                        {showBills === status.key && (
                          <div className="rounded-lg border border-gray-200 dark:border-gray-700 max-h-56 overflow-y-auto">
                            <button
                              onClick={() => addAllBills(status.key)}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700"
                            >
                              + Add all unpaid bills to {def.title}
                            </button>
                            {bills.filter(b => !b.is_paid).map(b => {
                              const auto = categorize(b.payee_name || '')
                              return (
                                <button
                                  key={b.id}
                                  onClick={() => addBill(b, status.key)}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between gap-2"
                                >
                                  <span className="truncate">{b.payee_name || 'Unknown payee'}</span>
                                  <span className="text-gray-400 shrink-0 tabular-nums">
                                    {b.due_date ? b.due_date.slice(5) : ''} {fmt(b.amount)}
                                  </span>
                                  {auto !== status.key && (
                                    <Badge variant="warning" className="text-[9px] shrink-0">
                                      suggests {auto}
                                    </Badge>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Explainer */}
      <Card>
        <CardContent className="p-5">
          <CardTitle2 />
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
            The 50/30/20 rule is a starting point, not a law. It works because the three buckets have very
            different consequences when they run out: needs failing means you cannot pay rent, wants failing
            means you cut something optional, and savings failing means the next emergency hits your credit.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {BUCKETS.map(b => (
              <div key={b.key} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <p className={`text-xs font-bold ${b.textColor} mb-1`}>{b.percent}% {b.title}</p>
                <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-0.5">
                  {b.examples.map(e => <li key={e}>· {e}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-3 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Use take-home pay, not gross. Pulling a bill from your Bills page uses the payee name to guess
            the right bucket, but you decide where it goes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function CardTitle2() {
  return (
    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
      <Target className="w-4 h-4" /> How the 50/30/20 rule works
    </p>
  )
}
