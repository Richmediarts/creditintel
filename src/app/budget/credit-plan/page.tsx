'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Target, CreditCard, TrendingUp, PlusCircle, Check, X, Trash2,
  CalendarCheck, Gauge, AlertTriangle, FileSearch,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status'
import { useAuth } from '@/lib/auth-context'
import { normalizeCreditPlanScores } from '@/lib/utils/credit-plan-scores'

interface PeriodPlan {
  period: { index: number; start: string; end: string; label: string }
  bills: { bill: { id: number; name: string; amount: number | null; amountStatus: string; isPaid: boolean; category: string | null } }[]
  availableToSpend: number
  remainingToAssign: number
  projectedEndingBalance: number
  shortfall: number
}

interface Dashboard {
  today: string
  currentPeriodIndex: number
  periods: PeriodPlan[]
  totalBankBalance: number
  unconfirmedReserve: number
}

interface Card_ {
  id: number
  name: string
  credit_limit: number
  current_balance: number
  is_active: number
}

interface CreditTask {
  id: number
  title: string
  type: string
  status: string
  target_date: string
  bureau: string
  notes: string
}

interface Dispute {
  id: number
  creditorName: string
  bureau: string
  status: string
  letterType: string
}

interface FicoScore {
  bureau: string
  score: number | null
}

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TASK_TYPE_LABEL: Record<string, string> = {
  report_review: 'Report review',
  dispute: 'Dispute / follow-up',
  payment: 'Debt payment habit',
  custom: 'Custom task',
}

const isDebtBill = (cat: string | null | undefined) => !!cat && /credit card|debt|loan|collection/i.test(cat)

function shortDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s + 'T00:00:00')
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function CreditPlanPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [cards, setCards] = useState<Card_[]>([])
  const [tasks, setTasks] = useState<CreditTask[]>([])
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [scores, setScores] = useState<FicoScore[]>([])
  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [notice, setNotice] = useState('')
  const [loadError, setLoadError] = useState('')
  const [taskForm, setTaskForm] = useState({ title: '', type: 'report_review', bureau: '', target_date: '' })

  const fetchAll = useCallback(async () => {
    setLoadError('')
    const paths = ['/api/budget/dashboard', '/api/budget/credit-cards', '/api/budget/credit-tasks', '/api/disputes', '/api/fico-scores']
    const results = await Promise.allSettled(paths.map(async path => {
      const response = await fetch(path)
      if (!response.ok) throw new Error('Unable to load ' + path)
      return response.json()
    }))
    const [dashboardResult, cardsResult, tasksResult, disputesResult, scoresResult] = results
    if (dashboardResult.status === 'fulfilled') {
      const value = dashboardResult.value.dashboard
      setDashboard(value && Array.isArray(value.periods) ? value : null)
    }
    if (cardsResult.status === 'fulfilled') setCards(Array.isArray(cardsResult.value.cards) ? cardsResult.value.cards : [])
    if (tasksResult.status === 'fulfilled') setTasks(Array.isArray(tasksResult.value.tasks) ? tasksResult.value.tasks : [])
    if (disputesResult.status === 'fulfilled') setDisputes(Array.isArray(disputesResult.value.disputes) ? disputesResult.value.disputes : [])
    if (scoresResult.status === 'fulfilled') setScores(normalizeCreditPlanScores(scoresResult.value.scores))
    if (results.some(result => result.status === 'rejected')) setLoadError('Some credit-plan information could not be loaded. Please refresh to try again; unavailable sections may be incomplete.')
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchAll()
  }, [user, authLoading, fetchAll])

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/budget/credit-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskForm),
    })
    if (res.ok) {
      setShowTaskForm(false)
      setTaskForm({ title: '', type: 'report_review', bureau: '', target_date: '' })
      flash('Task added to your credit plan.')
      await fetchAll()
    }
  }

  const toggleTask = async (t: CreditTask) => {
    const next = t.status === 'done' ? 'pending' : 'done'
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x))
    await fetch(`/api/budget/credit-tasks/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
  }

  const deleteTask = async (id: number) => {
    if (!confirm('Delete this task?')) return
    setTasks(prev => prev.filter(x => x.id !== id))
    await fetch(`/api/budget/credit-tasks/${id}`, { method: 'DELETE' })
  }

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 6000) }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  // ---- debt math ----
  const activeCards = cards.filter(c => c.is_active)
  const totalCardBalance = activeCards.reduce((s, c) => s + (Number(c.current_balance) || 0), 0)
  const totalLimit = activeCards.reduce((s, c) => s + (Number(c.credit_limit) || 0), 0)
  const utilization = totalLimit > 0 ? Math.round((totalCardBalance / totalLimit) * 100) : null

  const periodsWithDebt = (dashboard?.periods || []).map((p, i) => {
    const debtBills = p.bills.filter((a) => !a.bill.isPaid && isDebtBill(a.bill.category))
    const debtTotal = debtBills.reduce((s, a) => s + (Number(a.bill.amount) || 0), 0)
    return { i, period: p, debtBills, debtTotal }
  })

  const current = periodsWithDebt.find(x => x.i === dashboard?.currentPeriodIndex) || periodsWithDebt[0]
  const extraAvailable = current ? Math.max(0, current.period.availableToSpend) : 0

  const doneCount = tasks.filter(t => t.status === 'done').length
  const activeDisputes = disputes.filter(d => d.status !== 'complete')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Credit Improvement Plan</h1>
          <p className="text-sm text-gray-500">Debt payments per pay period, utilization, and dispute progress — tracking, not predictions.</p>
        </div>
        <Link href="/budget"><Button variant="secondary">← Back to Pay-Period Dashboard</Button></Link>
      </div>

      {loadError && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">{loadError}</div>}

      {notice && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" /> {notice}
        </div>
      )}

      {/* Scores */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(['Experian', 'Equifax', 'TransUnion'] as const).map((b) => {
          const s = scores.find(x => x.bureau === b)
          const score = s?.score
          return (
            <Card key={b} className="lift">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{b}</p>
                <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                  {score ? score : '—'}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {score
                    ? score >= 670 ? '@ ≥670 — generally "good" range' : 'below 670 — room to build'
                    : 'No score recorded yet'}
                </p>
              </CardContent>
            </Card>
          )
        })}
        <Card className="lift">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Card utilization</p>
              <Gauge className={`w-8 h-8 ${utilization == null ? 'text-gray-300' : utilization < 10 ? 'text-emerald-500' : utilization < 30 ? 'text-amber-500' : 'text-red-500'}`} aria-hidden="true" />
            </div>
            <p className={`text-2xl font-bold mt-1 ${utilization != null && utilization >= 30 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
              {utilization == null ? 'Unknown' : `${utilization}%`}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              {utilization == null
                ? 'Add credit limits to track'
                : `${fmt(totalCardBalance)} of ${fmt(totalLimit)} limit${utilization < 30 ? ' · under 30% is a common guideline' : ' · reducing may help, scores vary'}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Debt per pay period */}
      <Card className="lift">
        <CardContent className="p-5">
          <CardTitle className="text-base flex items-center gap-2 mb-3">
            <CalendarCheck className="w-5 h-5 text-violet-600 dark:text-violet-400" /> Debt Payments by Pay Period
          </CardTitle>
          <div className="space-y-3">
            {periodsWithDebt.map(({ i, period: p, debtBills, debtTotal }) => (
              <div key={i} className={`rounded-xl border p-4 ${i === dashboard?.currentPeriodIndex ? 'border-blue-300 dark:border-blue-700 ring-1 ring-blue-500/20' : 'border-gray-100 dark:border-gray-700'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{p.period.label}</span>
                    {i === dashboard?.currentPeriodIndex && <StatusPill status="info" label="Current" />}
                  </div>
                  <div className="text-sm font-bold tabular-nums text-violet-700 dark:text-violet-300">{fmt(debtTotal)}</div>
                </div>
                {debtBills.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {debtBills.map((a) => (
                      <span key={a.bill.id} className="pill pill-info">
                        {a.bill.name}{a.bill.amount == null || a.bill.amountStatus === 'missing' ? ' (amount unknown — not planned)' : ` ${fmt(Number(a.bill.amount))}`}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">No debt bills scheduled in this window.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                  <span>Remaining after known bills: <strong className="tabular-nums">{fmt(p.remainingToAssign)}</strong></span>
                  <span>Available to spend: <strong className={`tabular-nums ${p.availableToSpend < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{fmt(p.availableToSpend)}</strong></span>
                  <span>Projected end: <strong className="tabular-nums">{fmt(p.projectedEndingBalance)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Extra payment planning */}
      <Card className="lift border-violet-200 dark:border-violet-800/60">
        <CardContent className="p-5">
          <CardTitle className="text-base flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400" /> Funds for extra debt payoff
          </CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Money left in the current window after household obligations, reserves and the unconfirmed-expense
            reserve. Only commit what the plan genuinely supports — extra payments always come after the bills.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 px-5 py-4">
              <p className="text-xs uppercase tracking-wider text-violet-700 dark:text-violet-300">Current window</p>
              <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">{fmt(extraAvailable)}</p>
              <p className="text-[10px] text-violet-500 mt-1">availableToSpend after everything known</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
              To commit an extra payment, add a one-time bill on the{' '}
              <Link href="/budget/bills" className="underline font-medium">Bills page</Link> (payee e.g.
              &ldquo;Extra payoff — {activeCards[0]?.name || 'card'}&rdquo;, category Credit Cards) with a planned
              payment date inside the window. It becomes part of that window&apos;s obligations automatically.
            </p>
          </div>
          <AlertNote>
            Tracking note: paying down card balances improves utilization and debt-to-payable ratios, which many
            scoring models count as factors — we surface your data and progress, but never guarantee a score change.
          </AlertNote>
        </CardContent>
      </Card>

      {/* Credit tasks */}
      <Card className="lift">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Credit Report Tasks
              <span className="text-xs text-gray-400">({doneCount}/{tasks.length} done)</span>
            </CardTitle>
            <Button size="sm" onClick={() => setShowTaskForm(!showTaskForm)}>
              <PlusCircle className="w-4 h-4 mr-1" /> New Task
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Review each bureau report about once a month, track disputes you already filed, and follow-ups.
            See <Link href="/disputes" className="underline">Dispute Tracker</Link> for filed disputes.
          </p>
          {showTaskForm && (
            <form onSubmit={addTask} className="mb-4 grid grid-cols-1 sm:grid-cols-5 gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4">
              <input required placeholder="What needs doing?" value={taskForm.title} onChange={(e) => setTaskForm(f => ({ ...f, title: e.target.value }))}
                className="sm:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={taskForm.type} onChange={(e) => setTaskForm(f => ({ ...f, type: e.target.value }))}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(TASK_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select value={taskForm.bureau} onChange={(e) => setTaskForm(f => ({ ...f, bureau: e.target.value }))}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Any bureau</option>
                <option>Experian</option><option>Equifax</option><option>TransUnion</option>
              </select>
              <input type="date" title="Target date" value={taskForm.target_date} onChange={(e) => setTaskForm(f => ({ ...f, target_date: e.target.value }))}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="sm:col-span-5 flex gap-2">
                <Button type="submit" size="sm">Add Task</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowTaskForm(false)}><X className="w-4 h-4" /> Cancel</Button>
              </div>
            </form>
          )}
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">No tasks yet — start with a monthly review of each bureau report.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {tasks.map((t) => (
                <div key={t.id} className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => toggleTask(t)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        t.status === 'done' ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                      }`}
                      title={t.status === 'done' ? 'Mark pending' : 'Mark done'}
                    >
                      {t.status === 'done' && <Check className="w-3 h-3" />}
                    </button>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${t.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{t.title}</p>
                      <p className="text-xs text-gray-400">
                        {TASK_TYPE_LABEL[t.type] || t.type}
                        {t.bureau ? ` · ${t.bureau}` : ''}
                        {t.target_date ? ` · by ${shortDate(t.target_date)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {t.status === 'done' ? <StatusPill status="paid" label="Done" /> : <StatusPill status="estimated" label="Pending" />}
                    <button onClick={() => deleteTask(t.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disputes progress */}
      <Card className="lift">
        <CardContent className="p-5">
          <CardTitle className="text-base flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-rose-600 dark:text-rose-400" /> Dispute Progress
          </CardTitle>
          {activeDisputes.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">
              No open disputes. Upload a bureau report and generate letters from the{' '}
              <Link href="/dispute-letters" className="underline">Dispute Letters</Link> tool.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeDisputes.map((d) => (
                <div key={d.id} className="rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{d.creditorName}</p>
                      <p className="text-xs text-gray-400">{d.bureau} · {d.letterType}</p>
                    </div>
                    <span className="pill pill-estimated capitalize">{d.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {dashboard && dashboard.unconfirmedReserve > 0 && (
            <p className="mt-4 text-xs text-gray-400 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Your household reserve of {fmt(dashboard.unconfirmedReserve)}/period protects the plan while disputes resolve —
              collection accounts can change monthly statements.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AlertNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-4 py-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
