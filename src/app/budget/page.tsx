'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet, Receipt, PiggyBank, Banknote, CalendarDays,
  AlertTriangle, PlusCircle, ChevronRight, TrendingUp, RefreshCw,
  Users, CreditCard, CalendarCheck, CircleHelp, X, Check, Trash2,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusPill, OwnerPill } from '@/components/ui/status'
import { useAuth } from '@/lib/auth-context'

// ---------------------------------------------------------------------------
// Types mirroring the /api/budget/dashboard payload
// ---------------------------------------------------------------------------

interface AssignedBill {
  bill: {
    id: number
    name: string
    amount: number | null
    amountStatus: string
    dueDate: string | null
    dueDateStatus: string
    plannedPaymentDate: string | null
    owner: string
    category: string | null
    isPaid: boolean
    paidDate: string | null
  }
  payDate: string
  countedAmount: number
  overdue: boolean
}

interface PeriodPlan {
  period: { index: number; start: string; end: string; label: string }
  historical?: boolean
  bills: AssignedBill[]
  incoming: {
    income: { spouse: string; netAmount: number; payDate: string; received: boolean; label?: string }[]
    receivedTotal: number
    expectedTotal: number
  }
  billsTotal: number
  confirmedBillsTotal: number
  estimatedBillsTotal: number
  unknownCount: number
  overdueBills: AssignedBill[]
  allowancesTotal: number
  reservesTotal: number
  minimumDebtPayments: number
  totalOutgoing: number
  startBalance: number
  endingBalance: number
  projectedEndingBalance: number
  carriedOver: number
  availableNow: number
  remainingToAssign: number
  availableToSpend: number
  shortfall: number
  belowCushion: boolean
  belowCushionBy: number
  explanation: string
}

interface Dashboard {
  today: string
  anchoredPayday: string
  currentPeriodIndex: number
  paydaySource: string
  periods: PeriodPlan[]
  totalBankBalance: number
  unconfirmedReserve: number
  cushionTarget: number
  unknownAmountCount: number
  missingDueDateCount: number
  confirmedUnpaidTotal: number
  estimatedUnpaidTotal: number
  allowances: { name: string; amount: number; category: string | null }[]
  reserves: {
    id: number; name: string; targetAmount: number; targetDate: string | null
    amountSaved: number; perPeriod: number; status: string; progressPct: number
  }[]
  incomeScheduleWarnings: string[]
  notes: string[]
}

interface IncomeSchedule {
  id: number
  name: string
  spouse: string
  pay_start_date: string
  frequency: string
  net_amount: number
}

const OWNER_LABEL: Record<string, string> = { me: "Mine", wife: "Spouse's", shared: 'Shared' }

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtShort = (n: number): string =>
  '$' + Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')

function shortDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function longDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BudgetDashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [schedules, setSchedules] = useState<IncomeSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [anchorInput, setAnchorInput] = useState('')
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [showReserveForm, setShowReserveForm] = useState(false)
  const [notice, setNotice] = useState('')

  const [scheduleForm, setScheduleForm] = useState({
    name: '', spouse: 'me', pay_start_date: '', net_amount: '', frequency: 'biweekly',
  })
  const [reserveForm, setReserveForm] = useState({
    name: '', target_amount: '', target_date: '', amount_saved: '', per_period: '',
  })
  const [unconfirmedReserveInput, setUnconfirmedReserveInput] = useState('')

  const fetchAll = useCallback(async () => {
    const [dashRes, schedRes] = await Promise.all([
      fetch('/api/budget/dashboard'),
      fetch('/api/budget/schedules'),
    ])
    if (dashRes.ok) {
      const data = await dashRes.json()
      setDashboard(data.dashboard)
      setActiveIdx(data.dashboard.currentPeriodIndex)
      setUnconfirmedReserveInput(String(data.dashboard.unconfirmedReserve || ''))
    }
    if (schedRes.ok) {
      const data = await schedRes.json()
      setSchedules(data.schedules)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchAll()
  }, [user, authLoading, fetchAll])

  const regenerate = async () => {
    const params = new URLSearchParams()
    if (anchorInput) params.set('payday', anchorInput)
    params.set('periods', '6')
    const res = await fetch(`/api/budget/dashboard?${params}`)
    if (res.ok) {
      const data = await res.json()
      setDashboard(data.dashboard)
      setActiveIdx(data.dashboard.currentPeriodIndex)
      setNotice('Pay periods regenerated from ' + data.dashboard.anchoredPayday)
      setTimeout(() => setNotice(''), 5000)
    }
  }

  const addSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/budget/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: scheduleForm.name || 'Paycheck',
        spouse: scheduleForm.spouse,
        pay_start_date: scheduleForm.pay_start_date,
        frequency: scheduleForm.frequency,
        net_amount: parseFloat(scheduleForm.net_amount) || 0,
      }),
    })
    if (res.ok) {
      setShowScheduleForm(false)
      setScheduleForm({ name: '', spouse: 'me', pay_start_date: '', net_amount: '', frequency: 'biweekly' })
      setNotice('Income schedule added — the timeline now includes this paycheck stream.')
      await fetchAll()
      setTimeout(() => setNotice(''), 6000)
    }
  }

  const deleteSchedule = async (id: number) => {
    if (!confirm('Remove this income schedule?')) return
    setSchedules(prev => prev.filter(s => s.id !== id))
    await fetch(`/api/budget/schedules/${id}`, { method: 'DELETE' })
    await fetchAll()
  }

  const addReserve = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/budget/reserves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: reserveForm.name,
        target_amount: parseFloat(reserveForm.target_amount) || 0,
        target_date: reserveForm.target_date || null,
        amount_saved: parseFloat(reserveForm.amount_saved) || 0,
        per_period: parseFloat(reserveForm.per_period) || 0,
      }),
    })
    if (res.ok) {
      setShowReserveForm(false)
      setReserveForm({ name: '', target_amount: '', target_date: '', amount_saved: '', per_period: '' })
      setNotice('Reserve created.')
      await fetchAll()
      setTimeout(() => setNotice(''), 5000)
    }
  }

  const saveUnconfirmedReserve = async () => {
    const res = await fetch('/api/budget/household', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unconfirmed_reserve: parseFloat(unconfirmedReserveInput) || 0 }),
    })
    if (res.ok) {
      setNotice('Unconfirmed-expense reserve updated.')
      await fetchAll()
      setTimeout(() => setNotice(''), 5000)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Budget data unavailable</h1>
        <p className="text-sm text-gray-500 mb-4">No budget data found for your account yet.</p>
        <Link href="/budget/paychecks"><Button>Add a paycheck</Button></Link>
      </div>
    )
  }

  const current = dashboard.periods.find(p => p.period.index === activeIdx) ||
    dashboard.periods.find(p => !p.historical) ||
    dashboard.periods[0]

  const periodLabel = `${shortDate(dashboard.anchoredPayday)} → ${shortDate(nextAfterPayday(dashboard.anchoredPayday))}`

  return (
    <div className="space-y-6">
      {/* ============================ HERO ============================ */}
      <div className="money-hero rounded-2xl p-6 sm:p-8 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
              Household Pay-Period Plan
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-white leading-snug">
              Between this payday and the next — what needs to be paid,
              what have we reserved, and what can we still spend?
            </h1>
            <p className="mt-2 text-sm text-blue-200">
              Pay window {periodLabel} · anchored to your {dashboard.paydaySource}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="rounded-xl bg-white/10 px-5 py-4 text-right">
              <p className="stat-label text-xs font-medium uppercase tracking-wider">Money available right now</p>
              <p className={`stat-value text-3xl sm:text-4xl font-bold ${current.availableNow < 0 ? 'text-rose-300' : ''}`}>
                {fmt(current.availableNow)}
              </p>
              <p className="text-xs text-blue-200 mt-1">carried cash — before this period&apos;s bills</p>
            </div>
          </div>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" /> {notice}
        </div>
      )}

      {/* ============================ ALERTS ============================ */}
      {((current.shortfall > 0) || current.bills.some(a => a.overdue) || current.belowCushion ||
        dashboard.periods.some(p => !p.historical && p.shortfall > 0)) && (
        <div className="space-y-2">
          {current.shortfall > 0 && (
            <Alert tone="danger" icon={<AlertTriangle className="w-5 h-5" />}>
              <strong>Shortfall of {fmt(current.shortfall)} in {current.period.label}.</strong> Known obligations
              exceed cash in hand plus expected pay. Plan a transfer, defer a bill, or trim spending.
            </Alert>
          )}
          {dashboard.periods.some(p => !p.historical && p.period.index !== current.period.index && p.shortfall > 0) && (
            <Alert tone="warning">
              <strong>Future shortfall:</strong> {dashboard.periods
                .filter(p => !p.historical && p.period.index !== current.period.index && p.shortfall > 0)
                .map(p => `${shortDate(p.period.start)} (${fmt(p.shortfall)})`).join(', ')}
            </Alert>
          )}
          {current.bills.some(a => a.overdue) && (
            <Alert tone="danger" icon={<AlertTriangle className="w-5 h-5" />}>
              <strong>{current.bills.filter(a => a.overdue).length} overdue bill{current.bills.filter(a => a.overdue).length !== 1 ? 's' : ''}</strong>{' '}
              in this window: {current.bills.filter(a => a.overdue).map(a => a.bill.name).join(', ')}.
              Move the planned payment date on the{' '}
              <Link href="/budget/bills" className="underline font-medium">Bills page</Link>.
            </Alert>
          )}
          {current.belowCushion && (
            <Alert tone="warning">
              <strong>Below cash cushion by {fmt(current.belowCushionBy)}:</strong> the plan ends under your
              {fmt(dashboard.cushionTarget)} cushion target — projected, not guaranteed.
            </Alert>
          )}
        </div>
      )}

      {/* ==================== TIMELINE ==================== */}
      <Card className="lift">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Biweekly Pay-Period Timeline
            </CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="date"
                value={anchorInput}
                onChange={(e) => setAnchorInput(e.target.value)}
                title="Pick a payday to regenerate the timeline from"
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button variant="secondary" size="sm" onClick={regenerate}>
                <RefreshCw className="w-4 h-4 mr-1" /> Regenerate
              </Button>
              <Button size="sm" onClick={() => setShowScheduleForm(!showScheduleForm)}>
                <PlusCircle className="w-4 h-4 mr-1" /> Income Schedule
              </Button>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {dashboard.periods.map((p) => {
              const isCurrent = p.period.index === dashboard.currentPeriodIndex
              const isActive = p.period.index === activeIdx
              return (
                <button
                  key={p.period.index}
                  onClick={() => setActiveIdx(p.period.index)}
                  className={`period-chip flex-shrink-0 rounded-xl px-4 py-3 text-left w-44 ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 ring-2 ring-blue-500/30 active'
                      : p.historical
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 opacity-70'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" title="Current window" />}
                    Paycheck {p.period.index + 1}
                    {p.historical && <span className="text-[10px]">(past)</span>}
                  </div>
                  <div className={`text-sm font-semibold mt-0.5 ${p.shortfall > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    {p.period.label}
                  </div>
                  <div className="text-xs mt-1 flex items-center gap-1">
                    <span className={p.availableToSpend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                      {p.availableToSpend >= 0 ? '✓' : '✗'} {fmtShort(p.availableToSpend)}
                    </span>
                    <span className="text-gray-400">left</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    bills {fmtShort(p.billsTotal)}{p.unknownCount > 0 ? ` +${p.unknownCount}?` : ''}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ==================== ACTIVE PERIOD DETAIL ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Money available right now" chip="chip-spending" icon={Wallet}
          value={fmt(current.availableNow)}
          negative={current.availableNow < 0}
          sub="Cash in accounts this period start"
          href="/budget/bank-accounts"
        />
        <StatCard
          title="Income this window" chip="chip-income" icon={Banknote}
          value={`${fmt(current.incoming.expectedTotal)}${current.incoming.receivedTotal ? ` +${fmt(current.incoming.receivedTotal)} ✓` : ''}`}
          sub={
            current.incoming.receivedTotal
              ? `${fmt(current.incoming.receivedTotal)} received (already in balance) · ${fmt(current.incoming.expectedTotal)} expected`
              : 'Expected payday deposits (not in hand)'
          }
        />
        <StatCard
          title="Bills due in window" chip="chip-bills" icon={Receipt}
          value={dashboard.unconfirmedReserve > 0 || current.unknownCount > 0
            ? `${fmt(current.billsTotal)}${current.unknownCount ? ` +${current.unknownCount} ?` : ''}`
            : fmt(current.billsTotal)}
          negative
          sub={`${fmt(current.confirmedBillsTotal)} confirmed · ${fmt(current.estimatedBillsTotal)} estimated` +
            (current.unknownCount ? ` · ${current.unknownCount} unknown (not counted)` : '')}
          href="/budget/bills"
        />
        <StatCard
          title="Reserves + allowances" chip="chip-savings" icon={PiggyBank}
          value={fmt(current.reservesTotal + current.allowancesTotal)}
          sub={`${fmt(current.reservesTotal)} future-bill reserves · ${fmt(current.allowancesTotal)} allowances`}
        />
        <StatCard
          title="Remaining after known bills" chip="chip-spending" icon={TrendingUp}
          value={fmt(current.remainingToAssign)}
          negative={current.remainingToAssign < 0}
          sub="Available now − bills − allowances − reserves − minimums"
        />
        <StatCard
          title="Available to spend" chip="chip-income" icon={PiggyBank}
          value={fmt(current.availableToSpend)}
          negative={current.availableToSpend < 0}
          sub={dashboard.unconfirmedReserve > 0
            ? `After ${fmt(dashboard.unconfirmedReserve)} unconfirmed-expense reserve`
            : 'No unconfirmed reserve set'}
        />
        <StatCard
          title="Projected at period end" chip="chip-credit" icon={CalendarCheck}
          value={fmt(current.projectedEndingBalance)}
          negative={current.projectedEndingBalance < 0}
          sub={`Includes ${fmt(current.incoming.expectedTotal)} expected pay — projection, not cash in hand`}
        />
        <StatCard
          title="Minimum debt payments" chip="chip-credit" icon={CreditCard}
          value={fmt(current.minimumDebtPayments)}
          sub="Card minimums + debt bills in window"
          href="/budget/credit-plan"
        />
      </div>

      {/* ======== HOW THE NUMBERS WORK ======== */}
      <Card className="lift border-blue-200 dark:border-blue-800/60">
        <CardContent className="p-5">
          <CardTitle className="text-sm flex items-center gap-2 mb-2">
            <CircleHelp className="w-4 h-4 text-blue-600 dark:text-blue-400" /> How {current.period.label} was calculated
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{current.explanation}</p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { k: 'Available now', v: current.availableNow },
              { k: 'Outgoings', v: -current.totalOutgoing },
              { k: 'Expected pay', v: current.incoming.expectedTotal },
              { k: 'Projected end', v: current.projectedEndingBalance },
            ].map((row) => (
              <div key={row.k} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                <span className="text-gray-500 dark:text-gray-400">{row.k}</span>
                <span className={`block font-bold tabular-nums ${row.v < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                  {fmt(row.v)}
                </span>
              </div>
            ))}
          </div>
          {dashboard.notes.map((note, i) => (
            <p key={i} className="mt-2 text-xs text-amber-700 dark:text-amber-400">• {note}</p>
          ))}
        </CardContent>
      </Card>

      {/* ======== BILLS + INCOME IN THE WINDOW ======== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 lift">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <CardTitle className="text-base">Bills & Payments · {current.period.label}</CardTitle>
              <Link href="/budget/bills" className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center">
                Manage all bills <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {current.bills.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                Nothing scheduled in this window. Move a bill&apos;s planned payment date on the Bills page to fund it from this paycheck.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {current.bills.map(({ bill, payDate, overdue }) => (
                  <div key={bill.id} className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm font-medium ${bill.isPaid ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                          {bill.name}
                        </span>
                        {bill.isPaid ? <StatusPill status="paid" /> : overdue ? <StatusPill status="overdue" /> : null}
                        {!bill.isPaid && !overdue && (
                          <StatusPill
                            status={bill.amountStatus === 'estimated' ? 'estimated' : bill.amountStatus === 'missing' ? 'missing' : 'confirmed'}
                          />
                        )}
                        <OwnerPill owner={bill.owner} />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Due {shortDate(bill.dueDate)}
                        {bill.plannedPaymentDate && bill.plannedPaymentDate !== bill.dueDate
                          ? ` · pay early ${shortDate(bill.plannedPaymentDate)}`
                          : ''}
                        {payDate === 'unknown' ? ' · no date yet' : ''}
                        {' · '}{OWNER_LABEL[bill.owner] || 'Mine'}
                        {bill.category ? ` · ${bill.category}` : ''}
                      </p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      {bill.amountStatus === 'missing' || bill.amount == null ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
                          Unknown <StatusPill status="missing" label="Add amount" />
                        </span>
                      ) : (
                        <span className={`text-sm font-bold tabular-nums ${bill.isPaid ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                          {fmt(bill.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2.5 font-semibold text-sm text-gray-900 dark:text-white">
                  <span>Total due (known amounts)</span>
                  <span className="tabular-nums">{fmt(current.billsTotal)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Income in window */}
          <Card className="lift">
            <CardContent className="p-5">
              <CardTitle className="text-sm mb-3">Income · {current.period.label}</CardTitle>
              {current.incoming.income.length === 0 ? (
                <div className="text-sm text-gray-400 py-3 text-center">
                  No pay scheduled in this window.
                  <button onClick={() => setShowScheduleForm(true)} className="block mx-auto mt-2 text-blue-600 dark:text-blue-400 hover:underline">
                    Add an income schedule →
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {current.incoming.income.map((inc, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {inc.label || 'Paycheck'} <span className="text-xs text-gray-400">({inc.spouse === 'wife' ? "Spouse's" : inc.spouse === 'shared' ? 'Shared' : 'Mine'})</span>
                        </p>
                        <p className="text-xs text-gray-400">{shortDate(inc.payDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{fmt(inc.netAmount)}</p>
                        <span className={`pill ${inc.received ? 'pill-paid' : 'pill-estimated'}`}>
                          {inc.received ? '✓ Received' : '≈ Expected'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {dashboard.incomeScheduleWarnings.map((w, i) => (
                <p key={i} className="mt-2 text-xs text-amber-600 dark:text-amber-400">⚠ {w}</p>
              ))}
            </CardContent>
          </Card>

          {/* Unconfirmed reserve config */}
          <Card className="lift">
            <CardContent className="p-5">
              <CardTitle className="text-sm mb-1">Unconfirmed-expense reserve</CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Held aside each period for your spouse&apos;s bills we don&apos;t know yet, or anything unconfirmed.
              </p>
              <div className="flex gap-2">
                <input
                  type="number" step="0.01" min="0"
                  value={unconfirmedReserveInput}
                  onChange={(e) => setUnconfirmedReserveInput(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
                <Button size="sm" onClick={saveUnconfirmedReserve}>Save</Button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Currently {fmt(dashboard.unconfirmedReserve)} per period ·
                {' '}{dashboard.unknownAmountCount} unknown bill amount{dashboard.unknownAmountCount === 1 ? '' : 's'}{' '}
                excluded from totals
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ======== RESERVES ======== */}
      <Card className="lift">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-amber-600 dark:text-amber-400" /> Future-Bill Reserves
            </CardTitle>
            <Button size="sm" onClick={() => setShowReserveForm(!showReserveForm)}>
              <PlusCircle className="w-4 h-4 mr-1" /> New Reserve
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Set money aside across multiple paychecks for big bills — the reserved amount leaves
            &ldquo;available to spend&rdquo; each period but is never double-counted with the bill when it comes due.
          </p>
          {dashboard.reserves.length === 0 && !showReserveForm ? (
            <p className="text-sm text-gray-400 py-4 text-center">No reserves yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dashboard.reserves.map((r) => (
                <div key={r.id} className="rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        <span role="img" aria-hidden="true">🏦</span> {r.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {fmt(r.amountSaved)} of {fmt(r.targetAmount)}
                        {r.targetDate ? ` · target ${shortDate(r.targetDate)}` : ''} · {fmt(r.perPeriod)}/period
                      </p>
                    </div>
                    <StatusPill status={r.status === 'confirmed' ? 'confirmed' : 'estimated'} />
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
                      style={{ width: `${r.progressPct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {showReserveForm && (
            <form onSubmit={addReserve} className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4">
              <input required placeholder="What is it for?" value={reserveForm.name} onChange={(e) => setReserveForm(f => ({ ...f, name: e.target.value }))}
                className="sm:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input required type="number" step="0.01" min="0" placeholder="Target $" value={reserveForm.target_amount} onChange={(e) => setReserveForm(f => ({ ...f, target_amount: e.target.value }))}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="date" title="Needed by" value={reserveForm.target_date} onChange={(e) => setReserveForm(f => ({ ...f, target_date: e.target.value }))}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.01" min="0" placeholder="Saved" value={reserveForm.amount_saved} onChange={(e) => setReserveForm(f => ({ ...f, amount_saved: e.target.value }))}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input required type="number" step="0.01" min="0" placeholder="/period" value={reserveForm.per_period} onChange={(e) => setReserveForm(f => ({ ...f, per_period: e.target.value }))}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="sm:col-span-5 flex gap-2">
                <Button type="submit" size="sm">Create Reserve</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowReserveForm(false)}><X className="w-4 h-4" /> Cancel</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* ======== INCOME SCHEDULES ======== */}
      <Card className="lift">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Income Schedules (per spouse)
            </CardTitle>
            <Button size="sm" onClick={() => setShowScheduleForm(!showScheduleForm)}>
              <PlusCircle className="w-4 h-4 mr-1" /> Add Schedule
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Each spouse gets their own payday anchor. Paychecks you&apos;ve recorded stay the source of truth for
            received money — schedules are for expected pay.
          </p>
          {showScheduleForm && (
            <form onSubmit={addSchedule} className="mb-4 grid grid-cols-1 sm:grid-cols-5 gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4">
              <input placeholder="Name (e.g. Rich — DCPS)" value={scheduleForm.name} onChange={(e) => setScheduleForm(f => ({ ...f, name: e.target.value }))}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={scheduleForm.spouse} onChange={(e) => setScheduleForm(f => ({ ...f, spouse: e.target.value }))}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="me">Mine</option>
                <option value="wife">Spouse&apos;s</option>
                <option value="shared">Shared</option>
              </select>
              <input required type="date" title="First payday" value={scheduleForm.pay_start_date} onChange={(e) => setScheduleForm(f => ({ ...f, pay_start_date: e.target.value }))}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input required type="number" step="0.01" min="0" placeholder="Take-home per check" value={scheduleForm.net_amount} onChange={(e) => setScheduleForm(f => ({ ...f, net_amount: e.target.value }))}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={scheduleForm.frequency} onChange={(e) => setScheduleForm(f => ({ ...f, frequency: e.target.value }))}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="biweekly">Every 2 weeks</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Monthly</option>
              </select>
              <div className="sm:col-span-5 flex gap-2">
                <Button type="submit" size="sm">Save Schedule</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowScheduleForm(false)}><X className="w-4 h-4" /> Cancel</Button>
              </div>
            </form>
          )}
          {schedules.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">No schedules yet — add each spouse&apos;s payday to build the timeline.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {schedules.map((s) => (
                <div key={s.id} className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{s.name || 'Paycheck'}</p>
                    <p className="text-xs text-gray-400">
                      {s.spouse === 'wife' ? "Spouse's" : s.spouse === 'shared' ? 'Shared' : 'Mine'} ·
                      first pay {longDate(s.pay_start_date)} · every {s.frequency === 'biweekly' ? '2 weeks' : s.frequency}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{fmt(s.net_amount)}</span>
                    <button
                      onClick={() => deleteSchedule(s.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1"
                      title="Delete schedule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ======== MISSING / UNKNOWN SUMMARY ======== */}
      {(dashboard.unknownAmountCount > 0 || dashboard.missingDueDateCount > 0) && (
        <Alert tone="info" icon={<CircleHelp className="w-5 h-5" />}>
          <strong>Incomplete household details:</strong> {dashboard.unknownAmountCount} unknown amount{dashboard.unknownAmountCount === 1 ? '' : 's'},
          {' '}{dashboard.missingDueDateCount} missing date{dashboard.missingDueDateCount === 1 ? '' : 's'}.
          Unknown amounts are <em>never</em> counted as zero — they stay out of every total until confirmed, and the
          unconfirmed reserve covers them.{' '}
          <Link href="/budget/household" className="underline font-medium">Let your spouse add their bills →</Link>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/budget/bills"><QuickAction icon={<Receipt className="w-5 h-5" />} label="Bills & Calendar" sub="Assign bills to pay periods" cls="chip-bills" /></Link>
        <Link href="/budget/household"><QuickAction icon={<Users className="w-5 h-5" />} label="Household" sub="Sharing, members & contributions" cls="chip-shared" /></Link>
        <Link href="/budget/credit-plan"><QuickAction icon={<CreditCard className="w-5 h-5" />} label="Credit Improvement" sub="Debt paydown in each window" cls="chip-credit" /></Link>
      </div>
    </div>
  )
}

function nextAfterPayday(payday: string): string {
  const d = new Date(payday + 'T00:00:00')
  d.setDate(d.getDate() + 14)
  return d.toISOString().slice(0, 10)
}

function Alert({
  children, tone, icon,
}: {
  children: React.ReactNode
  tone: 'danger' | 'warning' | 'info'
  icon?: React.ReactNode
}) {
  const cls = {
    danger: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
  }[tone]
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${cls} flex items-start gap-3`}>
      <span className="mt-0.5 flex-shrink-0">{icon ?? <AlertTriangle className="w-5 h-5" />}</span>
      <div>{children}</div>
    </div>
  )
}

function StatCard({
  title, value, sub, icon: Icon, chip, href, negative,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  chip: string
  href?: string
  negative?: boolean
}) {
  const body = (
    <Card className={`h-full lift ${href ? 'cursor-pointer' : ''}`}>
      <CardContent className="p-5 flex items-start justify-between gap-3 h-full">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className={`text-xl sm:text-2xl font-bold mt-1 break-words ${negative ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{sub}</p>}
        </div>
        <div className={`chip ${chip} w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  )
  if (href) return <Link href={href} className="block h-full">{body}</Link>
  return body
}

function QuickAction({
  icon, label, sub, cls,
}: {
  icon: React.ReactNode
  label: string
  sub: string
  cls: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 lift">
      <div className={`chip ${cls} w-10 h-10 rounded-xl flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}
