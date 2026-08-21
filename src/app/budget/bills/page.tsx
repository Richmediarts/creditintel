'use client'

import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Receipt, PlusCircle, ArrowRight, Check, X, Trash2,
  Edit, CalendarDays,
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

function normalizeName(name?: string): string {
  if (!name) return ''
  return String(name)
    .replace(/[\u2018\u2019\u201A\u00B4]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Spreadsheet layout: sections in order, each with its bill names.
const SECTIONS: { title: string; bills: string[] }[] = [
  {
    title: 'Home & Utilities',
    bills: ['pennymac', 'brookside hoa fees (yrly)', 'truegreen', 'anthem', 'electric bill'],
  },
  {
    title: 'Transportation',
    bills: ['bridgecrest - sorento', 'capitalone auto loan', 'progressive', 'sorento fuel', 'jeep fuel'],
  },
  {
    title: 'Food & Personal',
    bills: ['groceries'],
  },
  {
    title: 'Internet / TV / Cell Phone / Home Security',
    bills: ['at&t wireless', 'xfinity', 'vivint security', 'security equipment (fortiva)'],
  },
  {
    title: 'Water/Gas/Electricity',
    bills: ['greystone power', 'gas south', 'paulding county water', 'community waste'],
  },
  {
    title: 'School Debt',
    bills: ['nelnet - ella', 'nelnet - richard'],
  },
  {
    title: 'Credit Cards',
    bills: [
      "ella's discover", "ella's old navy cc", "ella's apple card", "ella's pnc cash rewards",
      "ella's ally cc", "ella's avant cc", "ella's mission lane cc", "ella's indigo cc",
      "ella's destiny cc", "ella's prosper", "ella's navy federal", "rich amazon card",
      "rich's apple card", "mission lane", "rich's quicksilver cap1-9223", "rich's cap1 venture-6873",
      "rich's secure cap1-5491", "rich's plat2 cap1-5566", "rich's cap1 savor", "rich paypal credit",
      "pay pal credit", "credit one amex", "rich's indigo", "rich's plat2 cap1-8259",
      "rich's quicksilver cap1-2266",
    ],
  },
  {
    title: 'Other Expenses',
    bills: ['midland - (aph law)', 'klarna k&g (my suit)', "klarna - sam's club (ethans monitor)", 'klarna - walmart', 'klarna - stubhub', 'woodstock - law settlement'],
  },
]

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr || '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const EMPTY_FORM = {
  payee_name: '',
  amount: '',
  due_date: '',
  is_recurring: false,
  notes: '',
}

export default function BillsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    }>
      <BillsContent />
    </Suspense>
  )
}

function BillsContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const focusId = searchParams.get('bill')
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map())
  const skipBlurRef = useRef(false)
  const [inlineEdit, setInlineEdit] = useState<{ id: number; field: 'due_date' | 'amount' } | null>(null)
  const [inlineValue, setInlineValue] = useState('')

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

  useEffect(() => {
    if (!loading && focusId) {
      const el = rowRefs.current.get(Number(focusId))
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('bill-focus-ring')
        const timer = setTimeout(() => el.classList.remove('bill-focus-ring'), 2500)
        return () => clearTimeout(timer)
      }
    }
  }, [loading, focusId, bills])

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

  const startInlineEdit = (bill: Bill, field: 'due_date' | 'amount') => {
    setInlineEdit({ id: bill.id, field })
    setInlineValue(field === 'amount' ? String(bill.amount) : bill.due_date || '')
  }

  const cancelInlineEdit = () => {
    setInlineEdit(null)
    setInlineValue('')
  }

  const commitInlineEdit = async (bill: Bill, field: 'due_date' | 'amount') => {
    skipBlurRef.current = true
    if (!inlineEdit || inlineEdit.id !== bill.id || inlineEdit.field !== field) {
      cancelInlineEdit()
      return
    }
    const raw = inlineValue.trim()
    if (!raw) {
      cancelInlineEdit()
      return
    }
    const value = field === 'amount' ? (parseFloat(raw) || 0) : raw
    setBills((prev) =>
      prev.map((b) => (b.id === bill.id ? { ...b, [field]: value } : b))
    )
    if (editing && editing.id === bill.id) {
      setForm((f) => ({ ...f, [field]: String(value) }))
    }
    cancelInlineEdit()
    await fetch(`/api/budget/bills/${bill.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value }),
    })
  }

  const handleInlineKeyDown = (e: React.KeyboardEvent, bill: Bill, field: 'due_date' | 'amount') => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitInlineEdit(bill, field)
    } else if (e.key === 'Escape') {
      skipBlurRef.current = true
      cancelInlineEdit()
    }
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

  // Bucket bills into sections. Assigned payees use the spreadsheet's order;
  // anything unmatched goes into "Other Bills".
  const byName = new Map<string, Bill>()
  for (const b of bills) {
    const key = normalizeName(b.payee_name)
    const prev = byName.get(key)
    if (!prev || b.id < prev.id) byName.set(key, b)
  }

  const unmatched: Bill[] = []
  const usedIds = new Set<number>()
  const sectionGroups: { title: string; items: Bill[]; total: number }[] = []

  for (const section of SECTIONS) {
    const items: Bill[] = []
    for (const name of section.bills) {
      const b = byName.get(name)
      if (b && !usedIds.has(b.id)) {
        items.push(b)
        usedIds.add(b.id)
      }
    }
    sectionGroups.push({
      title: section.title,
      items: items.sort((a, b) => a.due_date.localeCompare(b.due_date)),
      total: items.reduce((s, b) => s + (Number(b.amount) || 0), 0),
    })
  }

  for (const b of bills) {
    if (!usedIds.has(b.id)) {
      unmatched.push(b)
      usedIds.add(b.id)
    }
  }
  unmatched.sort((a, b) => a.due_date.localeCompare(b.due_date))

  const grandTotal = bills.reduce((s, b) => s + (Number(b.amount) || 0), 0)

  const renderBillRow = (bill: Bill) => {
    const b = dueBadge(bill.due_date)
    const isFocused = focusId && Number(focusId) === bill.id
    return (
      <tr
        key={bill.id}
        ref={(el) => {
          if (el) rowRefs.current.set(bill.id, el)
          else rowRefs.current.delete(bill.id)
        }}
        className={`border-t border-gray-100 dark:border-gray-800 ${bill.is_paid ? 'bg-green-50/40 dark:bg-green-900/10' : ''} ${isFocused ? 'bill-focus-ring' : ''}`}
      >
        <td className="py-2 pr-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => handleTogglePaid(bill)}
              title={bill.is_paid ? 'Mark unpaid' : 'Mark paid'}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                bill.is_paid
                  ? 'border-green-500 bg-green-500 text-white'
                  : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
              }`}
            >
              {bill.is_paid ? <Check className="w-3 h-3" /> : null}
            </button>
            <span className={`text-sm font-medium truncate ${bill.is_paid ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
              {bill.payee_name || 'Unknown Payee'}
            </span>
          </div>
        </td>
        <td className="py-2 px-2 whitespace-nowrap">
          {inlineEdit && inlineEdit.id === bill.id && inlineEdit.field === 'due_date' ? (
            <input
              type="date"
              autoFocus
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              onBlur={() => { if (!skipBlurRef.current) commitInlineEdit(bill, 'due_date'); skipBlurRef.current = false }}
              onKeyDown={(e) => handleInlineKeyDown(e, bill, 'due_date')}
              className="rounded border border-blue-400 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <button
              onClick={() => startInlineEdit(bill, 'due_date')}
              title="Click to edit due date"
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-text text-left"
            >
              {bill.due_date ? formatDate(bill.due_date) : '—'}
            </button>
          )}
          {!bill.is_paid && bill.due_date && (
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${b.cls}`}>{b.text}</span>
          )}
        </td>
        <td className="py-2 px-2 text-right whitespace-nowrap">
          {inlineEdit && inlineEdit.id === bill.id && inlineEdit.field === 'amount' ? (
            <input
              type="number"
              step="0.01"
              autoFocus
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              onBlur={() => { if (!skipBlurRef.current) commitInlineEdit(bill, 'amount'); skipBlurRef.current = false }}
              onKeyDown={(e) => handleInlineKeyDown(e, bill, 'amount')}
              className="rounded border border-blue-400 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-right font-semibold tabular-nums text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <button
              onClick={() => startInlineEdit(bill, 'amount')}
              title="Click to edit amount"
              className={`text-sm font-semibold tabular-nums cursor-text text-right ${bill.is_paid ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400'}`}
            >
              {fmt(bill.amount)}
            </button>
          )}
        </td>
        <td className="py-2 pl-2 text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => handleEdit(bill)} className="text-gray-400 hover:text-amber-500 transition-colors p-1" title="Edit bill">
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDelete(bill)} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Delete bill">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  const renderSection = (group: { title: string; items: Bill[]; total: number }) => {
    if (group.items.length === 0) return null
    return (
      <div key={group.title}>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-6 mb-1">
          Category: {group.title}
        </p>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="py-2 px-3 font-medium">Payee</th>
                <th className="py-2 px-3 font-medium">Due Date</th>
                <th className="py-2 px-3 font-medium text-right">Amount</th>
                <th className="py-2 px-3 w-14" />
              </tr>
            </thead>
            <tbody>{group.items.map(renderBillRow)}</tbody>
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
                <td className="py-2 px-3 text-sm font-bold text-gray-900 dark:text-white" colSpan={2}>
                  Total
                </td>
                <td className="py-2 px-3 text-right text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                  {fmt(group.total)}
                </td>
                <td />
              </tr>
            </tfoot>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bills</h1>
          <p className="text-sm text-gray-500">Monthly budget bills grouped by category.</p>
        </div>
        {!showForm && (
          <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true) }}>
            <PlusCircle className="w-4 h-4 mr-2" /> Add Bill
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <Card>
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Monthly Total</p>
              <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{fmt(grandTotal)}</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
              <CalendarDays className="w-5 h-5" />
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

      {/* Sectioned bill list (spreadsheet layout) */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-sm">Monthly Budget</CardTitle>
            <span className="text-xs text-gray-400">{bills.length} bill{bills.length !== 1 ? 's' : ''}</span>
          </div>

          {bills.length > 0 ? (
            <div>
              {sectionGroups.map((g) => renderSection(g))}

              {unmatched.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-6 mb-1">
                    Category: Other Bills
                  </p>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/60 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          <th className="py-2 px-3 font-medium">Payee</th>
                          <th className="py-2 px-3 font-medium">Due Date</th>
                          <th className="py-2 px-3 font-medium text-right">Amount</th>
                          <th className="py-2 px-3 w-14" />
                        </tr>
                      </thead>
                      <tbody>{unmatched.map(renderBillRow)}</tbody>
                      <tfoot>
                        <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
                          <td className="py-2 px-3 text-sm font-bold text-gray-900 dark:text-white" colSpan={2}>Total</td>
                          <td className="py-2 px-3 text-right text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                            {fmt(unmatched.reduce((s, b) => s + (Number(b.amount) || 0), 0))}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}
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
