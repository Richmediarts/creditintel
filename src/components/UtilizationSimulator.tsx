'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Gauge, PiggyBank, Target, RotateCcw, RefreshCw, Wallet, ListOrdered, ChevronDown, ChevronUp, TrendingDown, TrendingUp, ChevronRight } from 'lucide-react'
import type { Bureau, FicoScores } from '@/types'

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { maximumFractionDigits: 0 })

interface CardRow {
  id: number
  name: string
  institution?: string
  credit_limit?: number
  current_balance?: number
}

interface RankedCard {
  id: number
  name: string
  limit: number
  balance: number
  util: number
}

interface Zone {
  label: string
  bar: string
  text: string
  chip: string
  description: string
}

const ZONES: Zone[] = [
  { label: 'Excellent', bar: 'bg-emerald-500', text: 'text-emerald-500', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', description: 'This range is ideal and can help you secure the best rates and approvals.' },
  { label: 'Good', bar: 'bg-green-500', text: 'text-green-500', chip: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', description: 'Solid range. Lenders generally view you as a low-risk borrower.' },
  { label: 'Fair', bar: 'bg-amber-500', text: 'text-amber-500', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', description: 'This range can start to raise red flags with some lenders.' },
  { label: 'Poor', bar: 'bg-red-500', text: 'text-red-500', chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', description: 'High utilization like this can significantly hurt your credit score.' },
]

function zoneFor(util: number): Zone {
  if (util < 10) return ZONES[0]
  if (util < 30) return ZONES[1]
  if (util < 50) return ZONES[2]
  return ZONES[3]
}

const TARGETS = [10, 20, 30, 50]

const BUREAUS: Bureau[] = ['Experian', 'Equifax', 'TransUnion']

const BUREAU_STYLES: Record<Bureau, { lightBg: string }> = {
  Experian: { lightBg: 'bg-blue-50 dark:bg-blue-950/30' },
  Equifax: { lightBg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  TransUnion: { lightBg: 'bg-purple-50 dark:bg-purple-950/30' },
}

function scoreLabel(score: number): string {
  if (score < 580) return 'Poor'
  if (score < 670) return 'Fair'
  if (score < 740) return 'Good'
  if (score < 800) return 'Very Good'
  return 'Excellent'
}

function scoreColor(score: number): string {
  if (score < 580) return 'text-red-500'
  if (score < 670) return 'text-orange-500'
  if (score < 740) return 'text-yellow-600 dark:text-yellow-400'
  if (score < 800) return 'text-green-500'
  return 'text-emerald-500'
}

function scoreBarColor(score: number): string {
  if (score < 580) return 'bg-red-500'
  if (score < 670) return 'bg-orange-500'
  if (score < 740) return 'bg-yellow-500'
  if (score < 800) return 'bg-green-500'
  return 'bg-emerald-600'
}

function utilImpact(fromUtil: number, toUtil: number): number {
  const target = Math.max(toUtil, 10)
  if (fromUtil <= 10) return 0
  const reduction = fromUtil - target
  if (reduction <= 0) return 0
  return Math.min(Math.floor(reduction / 5) * 8, 45)
}

function Field({ label, value, onChange, placeholder, hint }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-7 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {hint && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

export default function UtilizationSimulator() {
  const [limitStr, setLimitStr] = useState('')
  const [balanceStr, setBalanceStr] = useState('')
  const [paydown, setPaydown] = useState(0)
  const [target, setTarget] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [prefilled, setPrefilled] = useState<{ limit: number; balance: number } | null>(null)
  const [cards, setCards] = useState<CardRow[]>([])
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [payoffStr, setPayoffStr] = useState('')
  const [manualPayments, setManualPayments] = useState<Record<number, string>>({})
  const [ficoScores, setFicoScores] = useState<FicoScores>({})
  const [scoresLoading, setScoresLoading] = useState(true)

  const limit = parseFloat(limitStr) || 0
  const balance = parseFloat(balanceStr) || 0

  const fetchTotals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/budget/credit-cards', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const list: CardRow[] = data.cards || []
        const totalLimit = list.reduce((s, c) => s + (Number(c.credit_limit) || 0), 0)
        const totalBalance = list.reduce((s, c) => s + (Number(c.current_balance) || 0), 0)
        setCards(list)
        setPrefilled({ limit: totalLimit, balance: totalBalance })
        setLimitStr(totalLimit ? String(Math.round(totalLimit * 100) / 100) : '')
        setBalanceStr(totalBalance ? String(Math.round(totalBalance * 100) / 100) : '')
      }
    } catch {
      /* ignore */
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTotals()
  }, [fetchTotals])

  useEffect(() => {
    fetch('/api/fico-scores')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.scores) setFicoScores(data.scores)
      })
      .catch(() => { /* ignore */ })
      .finally(() => setScoresLoading(false))
  }, [])

  useEffect(() => {
    setPaydown((p) => Math.min(p, balance))
  }, [balance])

  const util = limit > 0 ? (balance / limit) * 100 : 0
  const simBalance = Math.max(0, balance - paydown)
  const simUtil = limit > 0 ? (simBalance / limit) * 100 : 0
  const currentZone = zoneFor(util)
  const simZone = zoneFor(simUtil)
  const available = limit - balance
  const marker = Math.min(util, 100)

  const applyPrefill = () => {
    if (!prefilled) return
    setLimitStr(prefilled.limit ? String(prefilled.limit) : '')
    setBalanceStr(prefilled.balance ? String(prefilled.balance) : '')
  }

  const reset = () => {
    applyPrefill()
    setPaydown(0)
    setTarget(null)
    setPayoffStr('')
    setManualPayments({})
  }

  const targetPayment = (pct: number) => {
    if (limit <= 0) return 0
    return Math.max(0, balance - (limit * pct) / 100)
  }

  const ranked: RankedCard[] = cards
    .map((card) => {
      const lim = Number(card.credit_limit) || 0
      const bal = Number(card.current_balance) || 0
      return { id: card.id, name: card.name, limit: lim, balance: bal, util: lim > 0 ? (bal / lim) * 100 : 0 }
    })
    .filter((r) => r.limit > 0)
    .sort((a, b) => b.util - a.util || b.balance - a.balance)

  const payoff = parseFloat(payoffStr) || 0

  const manualPaid = new Map<number, number>()
  let manualTotal = 0
  for (const r of ranked) {
    const raw = manualPayments[r.id]
    const v = raw === undefined || raw === '' ? 0 : parseFloat(raw)
    if (Number.isFinite(v) && v > 0) {
      manualPaid.set(r.id, v)
      manualTotal += v
    }
  }

  const autoTotal = Math.max(0, payoff - manualTotal)
  const alloc = new Map<number, number>()
  let remaining = autoTotal
  for (const r of ranked) {
    if (manualPaid.has(r.id)) continue
    const amt = Math.max(0, Math.min(r.balance, remaining))
    alloc.set(r.id, amt)
    remaining -= amt
    if (remaining <= 0) break
  }

  const effPaid = (id: number): number => manualPaid.get(id) ?? alloc.get(id) ?? 0

  const hasSim = payoff > 0 || manualTotal > 0
  const effTotalPayment = ranked.reduce((s, r) => s + Math.min(effPaid(r.id), r.balance), 0)
  const newTotalBalance = Math.max(0, balance - Math.min(effTotalPayment, balance))
  const newAggregate = limit > 0 ? (newTotalBalance / limit) * 100 : 0
  const projectedUtil = hasSim ? newAggregate : simUtil

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-blue-500" />
            <CardTitle>Credit Utilization Simulator</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchTotals}
              disabled={loading}
              title="Use my credit card totals"
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={reset}
              title="Reset"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 -mt-0.5">
          Your credit utilization ratio is the amount you owe on revolving credit divided by your total credit limit. It accounts for about 30% of your FICO score.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inputs + result */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total Credit Limit" value={limitStr} onChange={setLimitStr} placeholder="10,000" />
              <Field label="Total Balance Owed" value={balanceStr} onChange={setBalanceStr} placeholder="2,500" />
            </div>

            {prefilled && prefilled.limit > 0 && (
              <button
                onClick={applyPrefill}
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
              >
                <Wallet className="w-3 h-3" /> Use my totals: {fmt(prefilled.limit)} limit / {fmt(prefilled.balance)} balance
              </button>
            )}

            {limit > 0 && balance > 0 ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Your utilization</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${currentZone.chip}`}>{currentZone.label}</span>
                </div>
                <p className={`text-4xl font-bold mt-1 ${currentZone.text}`}>{util.toFixed(1)}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{currentZone.description}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
                    <p className="text-[10px] text-gray-400">Balance</p>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">{fmt(balance)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
                    <p className="text-[10px] text-gray-400">Limit</p>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">{fmt(limit)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
                    <p className="text-[10px] text-gray-400">Available</p>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">{fmt(Math.max(0, available))}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">Enter your total credit limit and balance to see your utilization ratio.</p>
              </div>
            )}

            {/* Gauge */}
            {limit > 0 && (
              <div>
                <div className="relative pt-6 pb-1">
                  <div className="flex h-3 w-full overflow-hidden rounded-full">
                    <div className="bg-emerald-500" style={{ width: '10%' }} />
                    <div className="bg-green-500" style={{ width: '20%' }} />
                    <div className="bg-amber-500" style={{ width: '20%' }} />
                    <div className="bg-red-500" style={{ width: '50%' }} />
                  </div>
                  <div
                    className="absolute top-0 -translate-x-1/2"
                    style={{ left: `${Math.min(marker, 100)}%` }}
                  >
                    <div className="mx-auto w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-gray-800 dark:border-b-gray-200" />
                    <div className="mx-auto mt-0.5 h-1.5 w-1 rounded-full bg-gray-800 dark:bg-gray-200" />
                  </div>
                  <p className="absolute -top-0 left-0 text-[10px] text-gray-400">0%</p>
                  <p className="absolute top-0 right-0 text-[10px] text-gray-400">100%</p>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                  <span className="text-emerald-600 dark:text-emerald-400">0-10% Excellent</span>
                  <span className="text-green-600 dark:text-green-400">10-30% Good</span>
                  <span className="text-amber-600 dark:text-amber-400">30-50% Fair</span>
                  <span className="text-red-500">50-100% Poor</span>
                </div>
              </div>
            )}
          </div>

          {/* Simulator */}
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
              <div className="flex items-center gap-2 mb-1">
                <PiggyBank className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Simulate a payoff</p>
              </div>
              <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mb-3">
                Drag to see how paying down your balance changes your utilization.
              </p>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400">Pay down</label>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(paydown)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(balance, 1)}
                  step={Math.max(1, Math.round(balance / 100))}
                  value={Math.min(paydown, Math.max(balance, 1))}
                  onChange={(e) => setPaydown(Number(e.target.value))}
                  disabled={balance <= 0}
                  className="w-full accent-blue-600"
                />
              </div>
              {balance > 0 && (
                <div className="mt-3 rounded-lg bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-gray-400">New utilization</p>
                      <p className={`text-xl font-bold ${simZone.text}`}>{simUtil.toFixed(1)}%</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${simZone.chip}`}>{simZone.label}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">
                    {paydown >= balance
                      ? 'Pay off your full balance to drop utilization to 0%.'
                      : simZone === currentZone
                        ? `Still ${simZone.label.toLowerCase()} after paying down ${fmt(paydown)}.`
                        : `Paying down ${fmt(paydown)} moves you from ${currentZone.label.toLowerCase()} to ${simZone.label.toLowerCase()}.`}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reach a target utilization</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                See how much you would need to pay down to hit a specific ratio.
              </p>
              <div className="flex flex-wrap gap-2">
                {TARGETS.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setTarget(target === pct ? null : pct)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      target === pct
                        ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-300 ring-2 ring-blue-500/20'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              {target !== null && balance > 0 && limit > 0 && (
                <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    To reach <span className="font-semibold">{target}%</span> utilization, pay down{' '}
                    <span className="font-semibold text-green-600 dark:text-green-400">{fmt(targetPayment(target))}</span>
                    {targetPayment(target) >= balance
                      ? ' (your entire current balance).'
                      : `, leaving ${fmt(balance - targetPayment(target))} on your cards.`}
                  </p>
                </div>
              )}
              {target !== null && (balance <= 0 || limit <= 0) && (
                <p className="mt-3 text-xs text-gray-400">Enter a balance and limit above to calculate the payment needed.</p>
              )}
            </div>
          </div>
        </div>

        {/* Projected FICO Scores */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Projected FICO Scores</p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 -mt-0.5">
            Estimate based on lowering aggregate utilization from {util.toFixed(1)}% to {projectedUtil.toFixed(1)}%. Utilization makes up about 30% of your FICO score.
          </p>
          {scoresLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin" />
              Loading your FICO scores...
            </div>
          ) : Object.values(ficoScores).some((s) => s?.score != null) ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {BUREAUS.map((bureau) => {
                const cur = ficoScores[bureau]?.score ?? null
                const impact = utilImpact(util, projectedUtil)
                const projected = cur != null ? Math.max(300, Math.min(850, cur + impact)) : null
                return (
                  <div key={bureau} className={`rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${BUREAU_STYLES[bureau].lightBg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{bureau}</p>
                      {cur != null && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${impact > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {impact > 0 ? `+${impact}` : 'No change'} pts
                        </span>
                      )}
                    </div>
                    {cur != null ? (
                      <>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">{cur}</span>
                          {impact > 0 && (
                            <>
                              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 self-center" />
                              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{projected}</span>
                            </>
                          )}
                        </div>
                        <p className={`text-xs font-medium mt-0.5 ${scoreColor(projected ?? cur)}`}>
                          {impact > 0 ? `${scoreLabel(cur)} → ${scoreLabel(projected ?? cur)}` : scoreLabel(cur)}
                        </p>
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-3">
                          <div className={`h-full rounded-full ${scoreBarColor(projected ?? cur)}`} style={{ width: `${(((projected ?? cur) - 300) / 550) * 100}%` }} />
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">
                        No {bureau} score entered.{' '}
                        <Link href="/fico-scores" className="text-blue-500 hover:underline">Add one</Link>
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              No FICO scores entered yet.{' '}
              <Link href="/fico-scores" className="text-blue-500 hover:underline">Go to FICO Scores</Link> to add them and see projected scores.
            </p>
          )}
        </div>

        {/* Card-by-card breakdown */}
        <div className="mt-6">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="inline-flex items-center gap-2 text-lg font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <ListOrdered className="w-4 h-4" />
            Card-by-card paydown breakdown
            {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showBreakdown && (
            <div className="mt-3 space-y-4">
              {ranked.length > 0 ? (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Cards are ranked by per-card utilization (highest first). Paying down a card above 30% utilization — especially above 50% — removes a bigger negative flag on your credit report than paying down an already-low card.
                  </p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Ranked list */}
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-base font-semibold text-gray-700 dark:text-gray-300">By biggest payoff impact</p>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {ranked.map((r, i) => {
                          const z = zoneFor(r.util)
                          const to30 = r.util > 30 ? r.balance - (r.limit * 0.3) : 0
                          const to10 = r.util > 10 ? r.balance - (r.limit * 0.1) : 0
                          const paid = effPaid(r.id)
                          const afterBalance = Math.max(0, r.balance - paid)
                          const afterUtil = r.limit > 0 ? (afterBalance / r.limit) * 100 : 0
                          const afterZone = zoneFor(afterUtil)
                          const affected = hasSim && paid > 0
                          return (
                            <div key={r.id} className="px-4 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0">{i + 1}</span>
                                  <p className="text-base font-medium text-gray-900 dark:text-white truncate">{r.name}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${(affected ? afterZone : z).chip}`}>{affected ? afterZone.label : z.label}</span>
                                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                                    {affected ? `${r.util.toFixed(0)}% → ${afterUtil.toFixed(0)}%` : `${r.util.toFixed(0)}%`}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                <div className={`h-full rounded-full ${z.bar}`} style={{ width: `${Math.min(r.util, 100)}%` }} />
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <span>
                                  {affected
                                    ? `${fmt(r.balance)} owed → ${fmt(afterBalance)} owed / ${fmt(r.limit)} limit`
                                    : `${fmt(r.balance)} owed / ${fmt(r.limit)} limit`}
                                </span>
                                {r.util > 10 && !affected && (
                                  <span>
                                    {to30 > 0 ? `to 30%: ${fmt(to30)}` : ''}
                                    {to30 > 0 && to10 > 0 ? ' · ' : ''}
                                    {to10 > 0 ? `to 10%: ${fmt(to10)}` : ''}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={manualPayments[r.id] ?? ''}
                                    onChange={(e) => setManualPayments((p) => ({ ...p, [r.id]: e.target.value.replace(/[^0-9.]/g, '') }))}
                                    placeholder="0"
                                    className="w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-6 pr-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <span className="text-sm text-gray-400 dark:text-gray-500">pay down</span>
                                {affected ? (
                                  <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                                    <TrendingDown className="w-4 h-4" />
                                    {fmt(paid)} → {fmt(afterBalance)} owed, utilization {afterUtil.toFixed(0)}% ({afterZone.label})
                                  </span>
                                ) : hasSim && r.balance > 0 ? (
                                  <span className="text-sm text-gray-400 dark:text-gray-500">no payment planned</span>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Planned payoff allocation */}
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">Plan a payoff</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        Enter a total amount to auto-allocate to the highest-utilization cards first, or type a manual amount on each card above. This is a simulation only — it does not change your stored card balances.
                      </p>
                      <div className="relative mb-3">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={payoffStr}
                          onChange={(e) => setPayoffStr(e.target.value.replace(/[^0-9.]/g, ''))}
                          placeholder="1,000"
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-7 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      {hasSim && ranked.filter((r) => effPaid(r.id) > 0).length > 0 && (
                        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 mb-3">
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {fmt(effTotalPayment)} goes to{' '}
                            {ranked.filter((r) => effPaid(r.id) > 0).map((r) => `${r.name} (${fmt(effPaid(r.id))})`).join(', ')}
                            .
                          </p>
                        </div>
                      )}
                      {hasSim && (
                        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Aggregate utilization</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{util.toFixed(1)}% → {newAggregate.toFixed(1)}%</p>
                          </div>
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(newAggregate, 100)}%` }} />
                          </div>
                          <p className="text-xs text-gray-400 mt-2">
                            Total balance goes from {fmt(balance)} to {fmt(newTotalBalance)}.
                          </p>
                        </div>
                      )}
                      {!hasSim && (
                        <p className="text-sm text-gray-400">Enter an amount to see which cards get paid down first and the resulting utilization.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400">No credit cards with limits found. Add credit cards to see the breakdown.</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">How utilization affects your score</p>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80 mt-0.5">
            Utilization makes up about 30% of your FICO score, right behind payment history. Keeping it under 30% is the common rule of thumb, but lower is better — under 10% is ideal. You can lower it by paying down balances or requesting higher credit limits.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
