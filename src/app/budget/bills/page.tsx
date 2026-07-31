'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet, CreditCard, TrendingUp, CalendarCheck, CalendarDays,
  Receipt, PiggyBank, PlusCircle, ArrowRight, Banknote,
  Landmark, WalletCards, CircleDollarSign, Check, X, Trash2,
  Edit, Calendar, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

interface Bill {
  id: number
  payee_name?: string
  amount: number
  due_date: string
  is_paid: number
  paid_date?: string
  is_recurring: number
  recurrence_type?: string
  notes?: string
  credit_card_id?: number
  account?: string
}

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

function dueBadge(dueDate: string) {
  const d = daysUntil(dueDate)
  if (d < 0) return { text: `Overdue ${-d}d`, cls: 'bg-red-600 text-white' }
  if (d === 0) return { text: 'Due Today', cls: 'bg-amber-500 text-black' }
  if (d <= 7) return { text: `${d} days`, cls: 'bg-amber-500 text-black' }
  return { text: `${d} days`, cls: 'bg-gray-600 text-white' }
}

const EMPTY_FORM = {
  payee_name: '',
  amount: '',
  due_date: '',
  is_recurring: false,
  notes: '',
}

export default function BillsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchBills = useCallback(async () => {
    const res = await fetch('/api/budget/bills')
    if (res.ok) {
      const data = await res.json()
      setBills(data.bills)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchBills()
  }, [user, authLoading, fetchBills])

  const totalUnpaid = bills
    .filter((b) => !b.is_paid)
    .reduce((s, b) => s + (Number(b.amount) || 0), 0)

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const totalPaidThisMonth = bills
    .filter((b) => b.is_paid && b.paid_date && b.paid_date >= monthStart && b.paid_date <= monthEnd)
    .reduce((s, b) => s + (Number(b.amount) || 0), 0)

  const handleTogglePaid = async (bill: Bill) => {
    const newPaid = !bill.is_paid
    setBills((prev) =>
      prev.map((b) =>
        b.id === bill.id
          ? { ...b, is_paid: newPaid ? 1 : 0, paid_date: newPaid ? new Date().toISOString().split('T')[0] : undefined }
          : b
      )
    )
    await fetch(`/api/budget/bills/${bill.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid: newPaid }),
    })
  }

  const handleDelete = async (bill: Bill) => {
    if (!window.confirm(`Delete bill to ${bill.payee_name || 'Unknown'}?`)) return
    setBills((prev) => prev.filter((b) => b.id !== bill.id))
    await fetch(`/api/budget/bills/${bill.id}`, { method: 'DELETE' })
  }

  const handleEdit = (bill: Bill) => {
    setEditing(bill)
    setForm({
      payee_name: bill.payee_name || '',
      amount: String(bill.amount),
      due_date: bill.due_date,
      is_recurring: !!bill.is_recurring,
      notes: bill.notes || '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    const payload = {
      payee_name: form.payee_name,
      amount: parseFloat(form.amount) || 0,
      due_date: form.due_date,
      is_recurring: form.is_recurring ? 1 : 0,
      notes: form.notes,
    }

    const url = editing ? `/api/budget/bills/${editing.id}` : '/api/budget/bills'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      setShowForm(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      await fetchBills()
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to save bill')
    }
    setSaving(false)
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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bills</h1>
          <p className="text-sm text-gray-500">Track and manage your monthly bills.</p>
        </div>
        {!showForm && (
          <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true) }}>
            <PlusCircle className="w-4 h-4 mr-2" /> Add Bill
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Unpaid</p>
              <p className="text-2xl font-bold mt-1 text-red-500">{fmt(totalUnpaid)}</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
              <Receipt className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Paid This Month</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{fmt(totalPaidThisMonth)}</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400">
              <Check className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {showForm && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-sm">
                {editing ? 'Edit Bill' : 'Add Bill'}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM) }}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Payee Name</label>
                  <input
                    type="text"
                    required
                    value={form.payee_name}
                    onChange={(e) => setForm((f) => ({ ...f, payee_name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Electric Company"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={form.due_date}
                    onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white">
                    <input
                      type="checkbox"
                      checked={form.is_recurring}
                      onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
                      className="rounded"
                    />
                    Recurring
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button type="submit" disabled={saving}>
                  <Check className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Bill'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Bills list */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="text-sm">All Bills</CardTitle>
            <span className="text-xs text-gray-400">{bills.length} bill{bills.length !== 1 ? 's' : ''}</span>
          </div>

          {bills.length > 0 ? (
            <div className="space-y-2">
              {bills.map((bill) => {
                const b = dueBadge(bill.due_date)
                return (
                  <div
                    key={bill.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors ${
                      bill.is_paid
                        ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                        : 'border-gray-100 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => handleTogglePaid(bill)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          bill.is_paid
                            ? 'border-green-500 bg-green-500 text-white'
                            : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                        }`}
                      >
                        {bill.is_paid ? <Check className="w-3.5 h-3.5" /> : null}
                      </button>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${bill.is_paid ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                          {bill.payee_name || 'Unknown Payee'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-gray-400">{bill.due_date}</p>
                          {bill.is_recurring ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 font-medium">Recurring</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${bill.is_paid ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                          {fmt(bill.amount)}
                        </p>
                        {!bill.is_paid && <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${b.cls}`}>{b.text}</span>}
                      </div>
                      <button
                        onClick={() => handleEdit(bill)}
                        className="text-gray-400 hover:text-amber-500 transition-colors p-1"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(bill)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Receipt className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No bills added yet.</p>
              <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true) }} className="mt-3">
                <PlusCircle className="w-4 h-4 mr-2" /> Add your first bill
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Back link */}
      <Link href="/budget">
        <Button variant="secondary"><ArrowRight className="w-4 h-4 mr-2 rotate-180" /> Back to Dashboard</Button>
      </Link>
    </div>
  )
}
