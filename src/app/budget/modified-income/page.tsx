'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DollarSign, PlusCircle, Trash2, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

interface ModifiedIncome {
  id: number
  amount: number
  entry_date: string
  period_type: string
  notes: string
  created_at: string
}

interface Bill {
  id: number
  payee_name?: string
  amount: number
  due_date: string
}

interface Stats {
  total_income: number
  total_expenses: number
  total_expenses_paid: number
  remaining: number
  bills_before_next_pay: Bill[]
  bills_before_next_pay_total: number
}

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

const PERIOD_OPTIONS = ['weekly', 'biweekly', 'monthly', 'yearly'] as const

export default function ModifiedIncomePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [incomes, setIncomes] = useState<ModifiedIncome[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(todayStr)
  const [periodType, setPeriodType] = useState<string>('monthly')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const fetchIncomes = useCallback(async () => {
    const res = await fetch('/api/budget/modified-income')
    if (res.ok) {
      const data = await res.json()
      setIncomes(data.incomes || [])
    }
  }, [])

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/budget/stats')
    if (res.ok) {
      const data = await res.json()
      setStats(data.stats)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) {
      fetchIncomes()
      fetchStats()
    }
  }, [user, authLoading, fetchIncomes, fetchStats])

  const totalModifiedIncome = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Please enter a valid amount')
      return
    }
    setSaving(true)
    const res = await fetch('/api/budget/modified-income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parsedAmount,
        entry_date: entryDate,
        period_type: periodType,
        notes,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage('Income entry added')
      setAmount('')
      setEntryDate(todayStr)
      setPeriodType('monthly')
      setNotes('')
      await fetchIncomes()
      await fetchStats()
    } else {
      setError(data.error || 'Failed to add income entry')
    }
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this income entry?')) return
    const res = await fetch(`/api/budget/modified-income/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchIncomes()
      await fetchStats()
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Modified / Extra Income</h1>
          <p className="text-sm text-gray-500">Track additional income sources beyond your regular paycheck.</p>
        </div>
        <Link href="/budget">
          <Button variant="secondary" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        </Link>
      </div>

      {message && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Modified Income</p>
              <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{fmt(totalModifiedIncome)}</p>
              <p className="text-xs text-gray-400 mt-1">{incomes.length} entries</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Bills Due</p>
              <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{fmt(stats?.bills_before_next_pay_total || 0)}</p>
              <p className="text-xs text-gray-400 mt-1">{stats?.bills_before_next_pay?.length || 0} bills</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Paid</p>
              <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{fmt(stats?.total_expenses_paid || 0)}</p>
              <p className="text-xs text-gray-400 mt-1">This period</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Remaining</p>
              <p className={`text-2xl font-bold mt-1 ${(stats?.remaining || 0) < 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                {fmt(stats?.remaining || 0)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Income minus expenses</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add form */}
      <Card>
        <CardContent className="p-5">
          <CardTitle className="text-sm mb-3">Add Income Entry</CardTitle>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Period</label>
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PERIOD_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-4">
              <Button type="submit" disabled={saving}>
                <PlusCircle className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Add Income'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Income history */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="text-sm">Income History</CardTitle>
            <Badge variant="info">{incomes.length} Entries</Badge>
          </div>
          {incomes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3 text-right">Amount</th>
                    <th className="py-2 pr-3">Period</th>
                    <th className="py-2 pr-3">Notes</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.map((inc) => (
                    <tr key={inc.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-3 text-gray-900 dark:text-white">{inc.entry_date}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-green-600">{fmt(inc.amount)}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="default">{inc.period_type}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300 text-xs">{inc.notes || '—'}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleDelete(inc.id)}
                          className="inline-flex items-center gap-1 text-red-500 text-xs font-medium"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <DollarSign className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No income entries recorded yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paid bills history */}
      {stats && stats.bills_before_next_pay.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <CardTitle className="text-sm">Upcoming Bills</CardTitle>
              <Badge variant="warning">{stats.bills_before_next_pay.length} Bills</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-3">Payee</th>
                    <th className="py-2 pr-3">Due Date</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.bills_before_next_pay.map((bill) => (
                    <tr key={bill.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-3 text-gray-900 dark:text-white">{bill.payee_name || 'Unknown'}</td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{bill.due_date}</td>
                      <td className="py-2 text-right font-semibold text-red-500">{fmt(bill.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-white">
              Total Due: {fmt(stats.bills_before_next_pay_total)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
