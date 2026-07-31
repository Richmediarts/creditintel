'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, DollarSign, Calendar, RotateCcw, Printer, Wallet, ArrowUpCircle, ArrowDownCircle, X } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

interface PeriodItem {
  id: string
  label: string
  est: number
  act: number
}

interface Period {
  id: number
  name: string
  date: string
  income: PeriodItem[]
  expenses: PeriodItem[]
}

interface Bill {
  id: number
  payee_name?: string
  amount: number
  due_date: string
  is_paid: number
}

interface Payee {
  name: string
}

interface Stats {
  biweekly_income: number
  last_paycheck_net: number
}

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const LS_KEY = 'interactiveBudgetBi'

function parseMDY(str: string): Date | null {
  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  const d = new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]))
  return isNaN(d.getTime()) ? null : d
}

function getPeriodDateRange(period: Period): { start: Date; end: Date } | null {
  const d = period.date.trim()
  if (!d) return null
  const rangeMatch = d.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{4})/)
  if (rangeMatch) {
    const start = parseMDY(rangeMatch[1])
    const end = parseMDY(rangeMatch[2])
    if (start && end) return { start, end }
  }
  const singleMatch = d.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
  if (singleMatch) {
    const start = parseMDY(singleMatch[1])
    if (start) {
      const end = new Date(start)
      end.setDate(end.getDate() + 13)
      return { start, end }
    }
  }
  return null
}

function billsInPeriod(period: Period, bills: Bill[]): Bill[] {
  const range = getPeriodDateRange(period)
  if (!range) return []
  return bills.filter((b) => {
    if (b.is_paid) return false
    if (!b.due_date) return false
    const due = new Date(b.due_date + 'T00:00:00')
    return !isNaN(due.getTime()) && due >= range.start && due <= range.end
  })
}

function findPeriodForDate(dueDateStr: string, periods: Period[]): Period {
  if (!dueDateStr || !periods.length) return periods[0]
  const due = new Date(dueDateStr + 'T00:00:00')
  if (isNaN(due.getTime())) return periods[periods.length - 1]
  let best: Period | null = null
  let bestDist = Infinity
  for (const p of periods) {
    if (!p.date.trim()) continue
    const range = getPeriodDateRange(p)
    if (range) {
      if (due >= range.start && due <= range.end) return p
      continue
    }
    const single = parseMDY(p.date.trim())
    if (single) {
      const dist = Math.abs(due.getTime() - single.getTime())
      if (dist < bestDist) {
        bestDist = dist
        best = p
      }
    }
  }
  return best || periods[periods.length - 1]
}

let nextId = 1000
function genId(): string {
  return 'n' + (nextId++).toString()
}

function buildDefaultState(biweeklyIncome: number): Period {
  return {
    id: 1,
    name: 'Bi-Weekly #1',
    date: '',
    income: [
      { id: 'i1', label: 'Salary', est: biweeklyIncome || 2000, act: biweeklyIncome || 0 },
      { id: 'i2', label: 'Side Hustle', est: 500, act: 0 },
    ],
    expenses: [],
  }
}

function loadState(): Period[] | null {
  try {
    const d = localStorage.getItem(LS_KEY)
    if (d) {
      const p = JSON.parse(d)
      if (p && p.periods) return p.periods
    }
  } catch { /* ignore */ }
  return null
}

function saveState(periods: Period[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ periods }))
  } catch { /* ignore */ }
}

export default function InteractiveBudgetPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [periods, setPeriods] = useState<Period[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [payees, setPayees] = useState<string[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [dateModalPeriodId, setDateModalPeriodId] = useState<number | null>(null)
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const filterRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    let income = 2000
    try {
      const [statsRes, billsRes, payeesRes] = await Promise.all([
        fetch('/api/budget/stats').catch(() => null),
        fetch('/api/budget/bills').catch(() => null),
        fetch('/api/budget/payees').catch(() => null),
      ])
      if (statsRes?.ok) {
        const d = await statsRes.json()
        setStats(d.stats)
        income = d.stats?.biweekly_income || 2000
      }
      if (billsRes?.ok) {
        const d = await billsRes.json()
        setBills(d.bills)
      }
      if (payeesRes?.ok) {
        const d = await payeesRes.json()
        setPayees(d.payees.map((p: Payee) => p.name))
      }
    } catch { /* continue with defaults */ }

    const saved = loadState()
    if (saved && saved.length > 0) {
      setPeriods(saved)
    } else {
      setPeriods([buildDefaultState(income), { ...buildDefaultState(income), id: 2, name: 'Bi-Weekly #2' }])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchData()
  }, [user, authLoading, fetchData])

  const persist = useCallback((newPeriods: Period[]) => {
    setPeriods(newPeriods)
    saveState(newPeriods)
  }, [])

  const updateValue = useCallback((pid: number, type: 'income' | 'expenses', iid: string, field: 'label' | 'est' | 'act', val: string | number) => {
    persist(periods.map((p) => {
      if (p.id !== pid) return p
      const list = type === 'income' ? p.income : p.expenses
      return {
        ...p,
        [type]: list.map((item) =>
          item.id === iid ? { ...item, [field]: field === 'label' ? String(val) : parseFloat(String(val)) || 0 } : item
        ),
      }
    }))
  }, [periods, persist])

  const addItem = useCallback((pid: number, type: 'income' | 'expenses') => {
    persist(periods.map((p) => {
      if (p.id !== pid) return p
      return {
        ...p,
        [type]: [...p[type], { id: genId(), label: type === 'income' ? 'New Income' : 'New Item', est: 0, act: 0 }],
      }
    }))
  }, [periods, persist])

  const deleteItem = useCallback((pid: number, type: 'income' | 'expenses', iid: string) => {
    persist(periods.map((p) => {
      if (p.id !== pid) return p
      return { ...p, [type]: p[type].filter((x) => x.id !== iid) }
    }))
  }, [periods, persist])

  const addBillItem = useCallback((pid: number, billId: number) => {
    const bill = bills.find((b) => b.id === billId)
    if (!bill) return
    persist(periods.map((p) => {
      if (p.id !== pid) return p
      return {
        ...p,
        expenses: [...p.expenses, { id: genId(), label: bill.payee_name || 'Unknown', est: bill.amount || 0, act: 0 }],
      }
    }))
  }, [periods, bills, persist])

  const addPeriod = useCallback(() => {
    const newP: Period = {
      id: Date.now(),
      name: 'New Period',
      date: '',
      income: [{ id: genId(), label: 'New Income', est: 0, act: 0 }],
      expenses: [{ id: genId(), label: 'New Item', est: 0, act: 0 }],
    }
    persist([...periods, newP])
  }, [periods, persist])

  const removePeriod = useCallback((pid: number) => {
    if (!confirm('Remove this period?')) return
    persist(periods.filter((p) => p.id !== pid))
  }, [periods, persist])

  const resetToDefault = useCallback(() => {
    if (!confirm('Reset to defaults? Your edits will be lost.')) return
    localStorage.removeItem(LS_KEY)
    const income = stats?.biweekly_income || 2000
    const newP = [buildDefaultState(income), { ...buildDefaultState(income), id: 2, name: 'Bi-Weekly #2' }]
    setPeriods(newP)
    saveState(newP)
  }, [stats])

  const openDateModal = useCallback((pid: number) => {
    const p = periods.find((x) => x.id === pid)
    setDateModalPeriodId(pid)
    setDateStart('')
    setDateEnd('')
    if (p && p.date) {
      const d = p.date.trim()
      const rangeMatch = d.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/)
      if (rangeMatch) {
        setDateStart(`${rangeMatch[3]}-${rangeMatch[1].padStart(2, '0')}-${rangeMatch[2].padStart(2, '0')}`)
        setDateEnd(`${rangeMatch[6]}-${rangeMatch[4].padStart(2, '0')}-${rangeMatch[5].padStart(2, '0')}`)
      } else {
        const singleMatch = d.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
        if (singleMatch) {
          setDateStart(`${singleMatch[3]}-${singleMatch[1].padStart(2, '0')}-${singleMatch[2].padStart(2, '0')}`)
        }
      }
    }
  }, [periods])

  const saveDateModal = useCallback(() => {
    if (!dateStart || dateModalPeriodId === null) return
    const sp = dateStart.split('-')
    const startFmt = `${sp[1]}/${sp[2]}/${sp[0]}`
    let dateStr = startFmt
    if (dateEnd) {
      const ep = dateEnd.split('-')
      dateStr = `${startFmt} - ${ep[1]}/${ep[2]}/${ep[0]}`
    }
    persist(periods.map((p) => p.id === dateModalPeriodId ? { ...p, date: dateStr } : p))
    setDateModalPeriodId(null)
  }, [dateStart, dateEnd, dateModalPeriodId, periods, persist])

  const clearDateModal = useCallback(() => {
    if (dateModalPeriodId !== null) {
      persist(periods.map((p) => p.id === dateModalPeriodId ? { ...p, date: '' } : p))
    }
    setDateModalPeriodId(null)
  }, [dateModalPeriodId, periods, persist])

  const handleKeyNav = (e: React.KeyboardEvent<HTMLInputElement>, el: HTMLInputElement) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const tbody = el.closest('tbody')
      if (!tbody) return
      const inputs = Array.from(tbody.querySelectorAll('input[type="number"]'))
      const idx = inputs.indexOf(el)
      el.blur()
      if (idx >= 0 && idx < inputs.length - 1) {
        const next = inputs[idx + 1] as HTMLInputElement
        next.focus()
        next.select()
      }
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  const LF = filter.toLowerCase()
  let totalInc = 0
  let totalExp = 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Interactive Budget</h1>
            <p className="text-sm text-gray-500">Real-time Financial Tracker</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={addPeriod} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Period</Button>
          <Button onClick={() => window.print()} variant="secondary" size="sm"><Printer className="w-4 h-4 mr-1" /> Print</Button>
          <Button onClick={resetToDefault} variant="secondary" size="sm"><RotateCcw className="w-4 h-4 mr-1" /> Reset</Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Income</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400" id="stat-total-income">$0.00</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
              <ArrowUpCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Expenses</p>
              <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400" id="stat-total-expenses">$0.00</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
              <ArrowDownCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Net Balance</p>
              <p className="text-2xl font-bold mt-1" id="stat-net-balance">$0.00</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <input
          ref={filterRef}
          type="text"
          placeholder="Filter by period, income, or expense name..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Payee datalist for autocomplete */}
      <datalist id="payee-datalist">
        {payees.map((name, i) => (
          <option key={i} value={name} />
        ))}
      </datalist>

      {/* Periods */}
      {periods.map((period) => {
        const pIncEst = period.income.reduce((s, i) => s + i.est, 0)
        const pIncAct = period.income.reduce((s, i) => s + i.act, 0)
        const pExpEst = period.expenses.reduce((s, i) => s + i.est, 0)
        const pExpAct = period.expenses.reduce((s, i) => s + i.act, 0)
        totalInc += pIncAct
        totalExp += pExpAct

        const filteredInc = period.income.filter((i) => !LF || i.label.toLowerCase().includes(LF))
        const filteredExp = period.expenses.filter((i) => !LF || i.label.toLowerCase().includes(LF))
        const periodMatch = !LF || period.name.toLowerCase().includes(LF) || period.date.toLowerCase().includes(LF)
        if (LF && !periodMatch && filteredInc.length === 0 && filteredExp.length === 0) return null

        const periodBills = billsInPeriod(period, bills)

        return (
          <Card key={period.id}>
            {/* Period Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="text"
                  value={period.name}
                  onChange={(e) => updateValue(period.id, 'income', period.income[0]?.id || '', 'label', period.name)}
                  onBlur={(e) => persist(periods.map((p) => p.id === period.id ? { ...p, name: e.target.value || p.name } : p))}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  className="text-base font-semibold text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                />
                <button
                  onClick={() => openDateModal(period.id)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                >
                  <Calendar className="w-3 h-3" />
                  {period.date || 'Set Date'}
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-400">Inc: {fmt(pIncEst)} est / {fmt(pIncAct)} act</span>
                <span className="text-xs text-gray-400">|</span>
                <span className="text-xs text-gray-400">Exp: {fmt(pExpEst)} est / {fmt(pExpAct)} act</span>
                <button onClick={() => removePeriod(period.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Remove period">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-gray-700">
                {/* Income */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <ArrowUpCircle className="w-4 h-4 text-emerald-500" /> Income
                    </h3>
                    <button onClick={() => addItem(period.id, 'income')} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">+ Add</button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">
                        <th className="text-left px-2 py-1.5 font-medium">Source</th>
                        <th className="text-right px-2 py-1.5 font-medium">Est.</th>
                        <th className="text-right px-2 py-1.5 font-medium">Actual</th>
                        <th className="text-right px-2 py-1.5 font-medium">Diff</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInc.map((item) => {
                        const diff = item.act - item.est
                        return (
                          <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800">
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                value={item.label}
                                onChange={(e) => updateValue(period.id, 'income', item.id, 'label', e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const tbody = (e.target as HTMLElement).closest('tbody'); const inputs = tbody ? Array.from(tbody.querySelectorAll('input[type="number"]')) as HTMLInputElement[] : []; if (inputs.length) { inputs[0].focus(); inputs[0].select() } } }}
                                className="w-full bg-transparent border-none text-sm text-gray-900 dark:text-white focus:outline-none p-0"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                step="0.01"
                                value={item.est}
                                onChange={(e) => updateValue(period.id, 'income', item.id, 'est', e.target.value)}
                                onKeyDown={(e) => handleKeyNav(e, e.target as HTMLInputElement)}
                                onFocus={(e) => e.target.select()}
                                className="w-full bg-transparent border-none border-b border-transparent focus:border-blue-500 text-sm text-right text-gray-900 dark:text-white focus:outline-none p-0"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                step="0.01"
                                value={item.act}
                                onChange={(e) => updateValue(period.id, 'income', item.id, 'act', e.target.value)}
                                onKeyDown={(e) => handleKeyNav(e, e.target as HTMLInputElement)}
                                onFocus={(e) => e.target.select()}
                                className="w-full bg-transparent border-none border-b border-transparent focus:border-blue-500 text-sm text-right text-gray-900 dark:text-white focus:outline-none p-0"
                              />
                            </td>
                            <td className={`px-2 py-1.5 text-right text-sm font-semibold ${diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                              {fmt(diff)}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <button onClick={() => deleteItem(period.id, 'income', item.id)} className="p-0.5 text-gray-400 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                      {filteredInc.length === 0 && (
                        <tr><td colSpan={5} className="text-center text-gray-400 py-3 text-xs">No items</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold border-t border-gray-200 dark:border-gray-700">
                        <td className="px-2 py-2 text-sm">Total</td>
                        <td className="px-2 py-2 text-sm text-right">{fmt(pIncEst)}</td>
                        <td className="px-2 py-2 text-sm text-right">{fmt(pIncAct)}</td>
                        <td className={`px-2 py-2 text-sm text-right ${pIncAct - pIncEst >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{fmt(pIncAct - pIncEst)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Expenses */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <ArrowDownCircle className="w-4 h-4 text-red-500" /> Expenses
                    </h3>
                    <div className="flex items-center gap-2">
                      {periodBills.length > 0 && (
                        <div className="relative group">
                          <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Bills ▾</button>
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 hidden group-hover:block min-w-[200px] max-h-[300px] overflow-y-auto">
                            {periodBills.map((b) => (
                              <button
                                key={b.id}
                                onClick={() => addBillItem(period.id, b.id)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between gap-2"
                              >
                                <span className="truncate">{b.payee_name || 'Unknown'}</span>
                                <span className="text-gray-400 shrink-0">{b.due_date ? b.due_date.slice(5) : ''} {fmt(b.amount)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <button onClick={() => addItem(period.id, 'expenses')} className="text-xs text-red-600 dark:text-red-400 hover:underline">+ Add</button>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">
                        <th className="text-left px-2 py-1.5 font-medium">Item</th>
                        <th className="text-right px-2 py-1.5 font-medium">Est.</th>
                        <th className="text-right px-2 py-1.5 font-medium">Actual</th>
                        <th className="text-right px-2 py-1.5 font-medium">Diff</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExp.map((item) => {
                        const diff = item.est - item.act
                        return (
                          <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800">
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                list="payee-datalist"
                                value={item.label}
                                onChange={(e) => updateValue(period.id, 'expenses', item.id, 'label', e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const tbody = (e.target as HTMLElement).closest('tbody'); const inputs = tbody ? Array.from(tbody.querySelectorAll('input[type="number"]')) as HTMLInputElement[] : []; if (inputs.length) { inputs[0].focus(); inputs[0].select() } } }}
                                className="w-full bg-transparent border-none text-sm text-gray-900 dark:text-white focus:outline-none p-0"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                step="0.01"
                                value={item.est}
                                onChange={(e) => updateValue(period.id, 'expenses', item.id, 'est', e.target.value)}
                                onKeyDown={(e) => handleKeyNav(e, e.target as HTMLInputElement)}
                                onFocus={(e) => e.target.select()}
                                className="w-full bg-transparent border-none border-b border-transparent focus:border-blue-500 text-sm text-right text-gray-900 dark:text-white focus:outline-none p-0"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                step="0.01"
                                value={item.act}
                                onChange={(e) => updateValue(period.id, 'expenses', item.id, 'act', e.target.value)}
                                onKeyDown={(e) => handleKeyNav(e, e.target as HTMLInputElement)}
                                onFocus={(e) => e.target.select()}
                                className="w-full bg-transparent border-none border-b border-transparent focus:border-blue-500 text-sm text-right text-gray-900 dark:text-white focus:outline-none p-0"
                              />
                            </td>
                            <td className={`px-2 py-1.5 text-right text-sm font-semibold ${diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                              {fmt(diff)}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <button onClick={() => deleteItem(period.id, 'expenses', item.id)} className="p-0.5 text-gray-400 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                      {filteredExp.length === 0 && (
                        <tr><td colSpan={5} className="text-center text-gray-400 py-3 text-xs">No items</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold border-t border-gray-200 dark:border-gray-700">
                        <td className="px-2 py-2 text-sm">Total</td>
                        <td className="px-2 py-2 text-sm text-right">{fmt(pExpEst)}</td>
                        <td className="px-2 py-2 text-sm text-right">{fmt(pExpAct)}</td>
                        <td className={`px-2 py-2 text-sm text-right ${pExpEst - pExpAct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{fmt(pExpEst - pExpAct)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Date Range Modal */}
      {dateModalPeriodId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Set Period Dates</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Leave blank for a 14-day period from start</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="secondary" size="sm" onClick={clearDateModal}>Clear</Button>
              <Button size="sm" onClick={saveDateModal} disabled={!dateStart}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Inject dynamic net balance color */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var totalInc = ${totalInc};
          var totalExp = ${totalExp};
          var bal = totalInc - totalExp;
          var el = document.getElementById('stat-net-balance');
          if (el) {
            el.textContent = '${fmt(totalInc - totalExp)}';
            el.className = 'text-2xl font-bold mt-1 ' + (bal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400');
          }
          var incEl = document.getElementById('stat-total-income');
          if (incEl) incEl.textContent = '${fmt(totalInc)}';
          var expEl = document.getElementById('stat-total-expenses');
          if (expEl) expEl.textContent = '${fmt(totalExp)}';
        })();
      ` }} />
    </div>
  )
}
