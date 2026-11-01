'use client'

import React, { Suspense, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Receipt, PlusCircle, ArrowRight, Check, X, Trash2,
  Edit, CalendarDays, ExternalLink, CheckCircle2 as CheckCircleIcon,
  ListFilter, Calendar as CalendarIcon, Columns3, Landmark,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusPill, OwnerPill } from '@/components/ui/status'
import { useAuth } from '@/lib/auth-context'
import { filterBills, EMPTY_BILL_FILTERS, type BillFilters } from '@/lib/utils/bill-filters'
import { BILL_CATEGORIES as SECTIONS } from '@/lib/utils/billCategories'
import {
  RECURRENCE_OPTIONS, recurrenceLabel, nextDueDate, formatDueDate,
  toDateString, parseDate,
} from '@/lib/utils/recurrence'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  url?: string
  planned_payment_date?: string | null
  owner?: string
  share_percent?: number
  amount_status?: string
  due_date_status?: string
  paid_amount?: number
}

interface BankAccount { id: number; name: string; account_type: string; is_active: number }
interface PeriodWindow { start: string; end: string; label: string }

const OWNER_OPT = [
  { value: 'me', label: "Mine (I pay it)" },
  { value: 'wife', label: "Spouse's (they pay it)" },
  { value: 'shared', label: 'Shared household' },
] as const

const AMOUNT_STATUS_OPT = [
  { value: 'confirmed', label: '✓ Confirmed amount' },
  { value: 'estimated', label: '≈ Estimated amount' },
  { value: 'missing', label: '? Unknown amount (not counted in totals)' },
] as const

const DUE_STATUS_OPT = [
  { value: 'confirmed', label: '✓ Confirmed date' },
  { value: 'estimated', label: '≈ Estimated date' },
  { value: 'missing', label: '? Not yet known' },
] as const

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr || '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const EMPTY_FORM = {
  payee_name: '',
  amount: '',
  due_date: '',
  planned_payment_date: '',
  owner: 'me',
  amount_status: 'confirmed',
  due_date_status: 'estimated' as string, // new manual entries default to estimated
  is_recurring: false,
  recurrence_type: 'monthly',
  account: '',
  notes: '',
  url: '',
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
  const [filters, setFilters] = useState<BillFilters>(EMPTY_BILL_FILTERS)
  const visibleBills = useMemo(() => filterBills(bills, filters), [bills, filters])
  const filtersActive = Object.values(filters).some(value => value !== '')
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [anchor, setAnchor] = useState<string>('')
  const [view, setView] = useState<'category' | 'period' | 'calendar'>('category')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [calMonth, setCalMonth] = useState(() => new Date())
  const searchParams = useSearchParams()
  const focusId = searchParams.get('bill')
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map())
  const skipBlurRef = useRef(false)
  const [inlineEdit, setInlineEdit] = useState<{ id: number; field: 'due_date' | 'amount' | 'planned_payment_date' } | null>(null)
  const [inlineValue, setInlineValue] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

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
    if (!user) return
    // Bank accounts (for the payment-account picker) and the current pay
    // period anchor (for grouping bills into biweekly windows).
    fetch('/api/budget/bank-accounts').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.accounts) setAccounts(d.accounts.filter((a: BankAccount) => a.is_active && a.account_type !== 'loan'))
    })
    fetch('/api/budget/dashboard').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.dashboard?.anchoredPayday) setAnchor(d.dashboard.anchoredPayday)
    })
  }, [user])

  // ---------------- derived helpers ----------------

  const effectivePayDate = (b: Bill): string | null =>
    b.planned_payment_date || b.due_date || null

  const owed = (b: Bill): number => {
    if (b.is_paid) return 0
    return Math.max(0, (Number(b.amount) || 0) - (Number(b.paid_amount) || 0))
  }

  const biweeklyWindows = useMemo<PeriodWindow[]>(() => {
    // Build windows around the anchor so the CURRENT window always includes
    // today when the anchor is in the past.
    const end = (() => {
      const d = new Date()
      d.setDate(d.getDate() + 6 * 14)
      return toDateString(d)
    })()
    const start = (() => {
      const today = toDateString(new Date())
      const a = anchor
      if (!a) return today
      // shift anchor forward/back so windows step 14 days from it
      const ad = parseDate(a)!
      const tod = parseDate(today)!
      const diff = Math.round((tod.getTime() - ad.getTime()) / 86400000)
      const shift = Math.floor(diff / 14) * 14
      const s = new Date(ad)
      s.setDate(s.getDate() + shift)
      return toDateString(s)
    })()
    const windows: PeriodWindow[] = []
    let cur = start
    let i = 0
    while (cur < end && i < 10) {
      const nd = parseDate(cur)!
      const e = new Date(nd)
      e.setDate(e.getDate() + 13)
      windows.push({
        start: cur,
        end: toDateString(e),
        label: `${nd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      })
      const next = new Date(nd)
      next.setDate(next.getDate() + 14)
      cur = toDateString(next)
      i++
    }
    return windows
  }, [anchor])

  function billInWindow(b: Bill, w: PeriodWindow): boolean {
    const owedAmt = owed(b)
    if (b.is_paid) {
      return !!b.paid_date && b.paid_date >= w.start && b.paid_date <= w.end
    }
    if (owedAmt === 0) return false
    const p = effectivePayDate(b)
    return !!p && p >= w.start && p <= w.end
  }

  // ---------------- actions ----------------

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 6000) }

  const handleTogglePaid = async (bill: Bill) => {
    const newPaid = !bill.is_paid
    if (newPaid) {
      const isRecurring = !!bill.is_recurring
      const rollTo = isRecurring ? nextDueDate(bill.due_date, bill.recurrence_type || '') : null
      const when = rollTo ? formatDueDate(rollTo) : 'the current date'
      const message = isRecurring
        ? `Mark "${bill.payee_name || 'this bill'}" paid?\n\nIt repeats ${recurrenceLabel(bill.recurrence_type).toLowerCase()}, so the due date will move to ${when} and it will return to your unpaid list.`
        : `Mark "${bill.payee_name || 'this bill'}" paid?\n\nThis bill is not set to recurring, so it will stay closed and will not reappear.`
      if (!confirm(message)) return
    }
    setBills((prev) =>
      prev.map((b) =>
        b.id === bill.id
          ? { ...b, is_paid: newPaid ? 1 : 0, paid_date: newPaid ? toDateString(new Date()) : undefined }
          : b
      )
    )
    const res = await fetch(`/api/budget/bills/${bill.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid: newPaid }),
    })
    if (newPaid) {
      const data = await res.json().catch(() => ({}))
      if (data.nextDueDate) {
        flash(`${bill.payee_name || 'Bill'} marked paid — next due ${formatDueDate(data.nextDueDate)}`)
        await fetchBills()
      } else {
        flash(`${bill.payee_name || 'Bill'} marked paid.`)
      }
    }
  }

  const handlePartial = async (bill: Bill) => {
    const remaining = owed(bill)
    if (remaining <= 0) return
    const input = prompt(
      `Partial payment to "${bill.payee_name || 'bill'}":\n\nRemaining balance ${fmt(remaining)}.` +
      `\nHow much are you paying now?`,
      ''
    )
    if (input === null) return
    const amt = parseFloat(input)
    if (!amt || amt <= 0) return
    const already = Number(bill.paid_amount) || 0
    const newPaid = Math.min(remaining, amt) + already
    const fullyPaid = newPaid >= Number(bill.amount)
    setBills((prev) => prev.map((b) => b.id === bill.id
      ? { ...b, paid_amount: newPaid, is_paid: fullyPaid ? 1 : b.is_paid }
      : b
    ))
    await fetch(`/api/budget/bills/${bill.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'paid_amount', value: Math.round(newPaid * 100) / 100 }),
    })
    if (fullyPaid) {
      await fetch(`/api/budget/bills/${bill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: true }),
      })
    }
    const left = Math.max(0, Number(bill.amount) - newPaid)
    flash(
      left === 0
        ? `Fully paid via partial payments (${fmt(newPaid)}).`
        : `Partial payment recorded — ${fmt(left)} still owed.`
    )
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
      amount: bill.amount ? String(bill.amount) : '',
      due_date: bill.due_date || '',
      planned_payment_date: bill.planned_payment_date || '',
      owner: bill.owner || 'me',
      amount_status: bill.amount_status || 'confirmed',
      due_date_status: bill.due_date_status || 'confirmed',
      is_recurring: !!bill.is_recurring,
      recurrence_type: bill.recurrence_type || 'monthly',
      account: bill.account || '',
      notes: bill.notes || '',
      url: bill.url || '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startInlineEdit = (bill: Bill, field: 'due_date' | 'amount' | 'planned_payment_date') => {
    setInlineEdit({ id: bill.id, field })
    setInlineValue(
      field === 'amount' ? String(bill.amount ?? '') :
      field === 'planned_payment_date' ? (bill.planned_payment_date || '') : (bill.due_date || '')
    )
  }

  const cancelInlineEdit = () => {
    setInlineEdit(null)
    setInlineValue('')
  }

  const commitInlineEdit = async (bill: Bill, field: 'due_date' | 'amount' | 'planned_payment_date') => {
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
      setForm((f) => ({ ...f, [field]: field === 'amount' ? String(value) : value }))
    }
    cancelInlineEdit()
    await fetch(`/api/budget/bills/${bill.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value }),
    })
  }

  const handleInlineKeyDown = (e: React.KeyboardEvent, bill: Bill, field: 'due_date' | 'amount' | 'planned_payment_date') => {
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

    const amountKnown = form.amount_status !== 'missing'
    const payload = {
      payee_name: form.payee_name,
      amount: amountKnown ? (parseFloat(form.amount) || 0) : 0,
      due_date: form.due_date,
      planned_payment_date: form.planned_payment_date || null,
      owner: form.owner,
      amount_status: form.amount_status,
      due_date_status: form.due_date ? (form.due_date_status || 'estimated') : 'missing',
      is_recurring: form.is_recurring ? 1 : 0,
      recurrence_type: form.is_recurring ? (form.recurrence_type || 'monthly') : '',
      account: form.account,
      notes: form.notes,
      url: form.url.trim(),
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
      flash(editing ? 'Bill updated.' : 'Bill added to the household list.')
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to save bill')
    }
    setSaving(false)
  }

  // ---------------- summary ----------------

  const totalUnpaid = visibleBills.reduce((s, b) => s + owed(b), 0)
  const unknownAmounts = visibleBills.filter((b) => !b.is_paid && (b.amount_status === 'missing' || !(Number(b.amount) > 0))).length
  const missingDates = visibleBills.filter((b) => !b.is_paid && !b.due_date).length
  const overdueBills = visibleBills.filter((b) => !b.is_paid && b.due_date && daysUntil(b.due_date) < 0)

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const totalPaidThisMonth = visibleBills
    .filter((b) => b.is_paid && b.paid_date && b.paid_date >= monthStart && b.paid_date <= monthEnd)
    .reduce((s, b) => s + (Number(b.paid_amount) || Number(b.amount) || 0), 0)

  // (hooks stay above the loading early-return) ----------------------------
  const calendarCells = useMemo(() => {
    const y = calMonth.getFullYear()
    const m = calMonth.getMonth()
    const first = new Date(y, m, 1)
    const startPad = first.getDay()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const cells: { date: string | null; dom: number }[] = []
    for (let i = 0; i < startPad; i++) cells.push({ date: null, dom: 0 })
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dom: d })
    }
    return cells
  }, [calMonth])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  // ---------------- view: by category (existing style) ----------------

  const byName = new Map<string, Bill>()
  for (const b of visibleBills) {
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
      if (b && !usedIds.has(b.id)) { items.push(b); usedIds.add(b.id) }
    }
    sectionGroups.push({
      title: section.title,
      items: items.sort((a, b) => effectivePayDate(a)?.localeCompare(effectivePayDate(b) || '', undefined, { numeric: true }) || 0),
      total: items.reduce((s, b) => s + owed(b), 0),
    })
  }
  for (const b of visibleBills) {
    if (!usedIds.has(b.id)) { unmatched.push(b); usedIds.add(b.id) }
  }
  unmatched.sort((a, b) => effectivePayDate(a)?.localeCompare(effectivePayDate(b) || '', undefined, { numeric: true }) || 0)

  // ---------------- view: grouped by pay period ----------------

  const periodGroups: { window: PeriodWindow; items: Bill[]; total: number; hasCurrent: boolean }[] = []
  {
    const today = toDateString(new Date())
    const todayStr2 = today
    for (const w of biweeklyWindows) {
      const items = visibleBills.filter((b) => billInWindow(b, w))
      const sorted = items.sort((a, b) => effectivePayDate(a)?.localeCompare(effectivePayDate(b) || 'z', undefined, { numeric: true }) || 0)
      periodGroups.push({
        window: w,
        items: sorted,
        total: items.reduce((s, b) => s + owed(b), 0),
        hasCurrent: todayStr2 >= w.start && todayStr2 <= w.end,
      })
    }
  }
  const undefinedDateBills = visibleBills.filter((b) => !b.is_paid && owed(b) > 0 && !effectivePayDate(b))

  // ---------------- view: month calendar ----------------

  const billsOn = (date: string): Bill[] =>
    visibleBills.filter((b) => effectivePayDate(b) === date && (b.is_paid ? !b.is_paid || b.paid_date === date : true))

  // ---------------- row renderer ----------------

  const renderBillRow = (bill: Bill) => {
    const payDate = effectivePayDate(bill)
    const b = payDate ? dueBadge(payDate) : null
    const isFocused = focusId && Number(focusId) === bill.id
    const amtStatus = bill.amount_status || 'confirmed'
    const isUnknown = amtStatus === 'missing' || !(Number(bill.amount) > 0)
    const partial = Number(bill.paid_amount) || 0

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
              title={bill.is_paid ? 'Mark unpaid' : 'Mark paid in full'}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                bill.is_paid
                  ? 'border-green-500 bg-green-500 text-white'
                  : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
              }`}
            >
              {bill.is_paid ? <Check className="w-3 h-3" /> : null}
            </button>
            {bill.url ? (
              <a
                href={bill.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${bill.payee_name || 'bill'} website`}
                className={`text-sm font-medium truncate ${bill.is_paid ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300'} inline-flex items-center gap-1`}
              >
                {bill.payee_name || 'Unknown Payee'}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            ) : (
              <span className={`text-sm font-medium truncate ${bill.is_paid ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                {bill.payee_name || 'Unknown Payee'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 mt-1 pl-7.5">
            <OwnerPill owner={bill.owner || 'me'} />
            {bill.is_paid
              ? <StatusPill status="paid" />
              : isUnknown
                ? <StatusPill status="missing" label="Unknown amount" />
                : amtStatus === 'estimated'
                  ? <StatusPill status="estimated" />
                  : <StatusPill status="confirmed" />}
            {partial > 0 && !bill.is_paid && (
              <span className="pill pill-info" title={`${fmt(partial)} paid so far`}>⧗ {fmt(partial)} paid</span>
            )}
            {bill.is_recurring && (
              <span className="pill pill-info">🔁 {recurrenceLabel(bill.recurrence_type)}</span>
            )}
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
              {bill.due_date ? (
                <>
                  {formatDate(bill.due_date)}
                  {(bill.due_date_status || 'confirmed') === 'estimated' && <span className="text-amber-600 dark:text-amber-400" title="Estimated date"> ≈</span>}
                  {(bill.due_date_status || 'confirmed') === 'missing' && <span className="text-gray-400" title="Date not confirmed"> ?</span>}
                </>
              ) : <StatusPill status="missing" label="No date yet" />}
            </button>
          )}
          {!bill.is_paid && b && (
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${b.cls}`}>{b.text}</span>
          )}
        </td>
        <td className="py-2 px-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
          {inlineEdit && inlineEdit.id === bill.id && inlineEdit.field === 'planned_payment_date' ? (
            <input
              type="date"
              autoFocus
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              onBlur={() => { if (!skipBlurRef.current) commitInlineEdit(bill, 'planned_payment_date'); skipBlurRef.current = false }}
              onKeyDown={(e) => handleInlineKeyDown(e, bill, 'planned_payment_date')}
              className="rounded border border-blue-400 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : bill.planned_payment_date && bill.planned_payment_date !== bill.due_date ? (
            <button
              onClick={() => startInlineEdit(bill, 'planned_payment_date')}
              title="Click to edit planned payment date"
              className="underline decoration-dotted hover:text-blue-600 dark:hover:text-blue-400 cursor-text"
            >
              pay {formatDate(bill.planned_payment_date)}
            </button>
          ) : (
            <button
              onClick={() => startInlineEdit(bill, 'planned_payment_date')}
              title="Click to plan an earlier payment date"
              className="text-gray-300 dark:text-gray-600 hover:text-blue-500 cursor-text"
            >
              — pay early
            </button>
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
          ) : isUnknown ? (
            <button
              onClick={() => startInlineEdit(bill, 'amount')}
              title="Amount unknown — click to add it"
              className="text-sm font-semibold tabular-nums cursor-text text-right text-amber-600 dark:text-amber-400 hover:underline"
            >
              Unknown
            </button>
          ) : partial > 0 && !bill.is_paid ? (
            <button
              onClick={() => startInlineEdit(bill, 'amount')}
              title="Click to edit full amount"
              className="cursor-text text-right"
            >
              <span className="block text-sm font-bold tabular-nums text-gray-900 dark:text-white">{fmt(owed(bill))}</span>
              <span className="block text-[10px] text-gray-400 tabular-nums">of {fmt(bill.amount)}</span>
            </button>
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
            {!bill.is_paid && !isKnownUnpaidDone(bill) && !isUnknown && owed(bill) > 0 && (
              <button onClick={() => handlePartial(bill)} className="text-gray-400 hover:text-emerald-600 transition-colors p-1" title="Record a partial payment">
                ⧗
              </button>
            )}
            {!bill.is_paid && bill.owner !== 'shared' && (
              <button
                onClick={async () => {
                  const next = bill.owner === 'me' ? 'shared' : bill.owner === 'shared' ? 'wife' : 'me'
                  setBills((prev) => prev.map((x) => x.id === bill.id ? { ...x, owner: next } : x))
                  await fetch(`/api/budget/bills/${bill.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ field: 'owner', value: next }),
                  })
                }}
                title="Cycle owner: mine → shared → spouse's"
                className="text-gray-400 hover:text-cyan-600 transition-colors p-1 text-xs"
              >
                {bill.owner === 'me' ? '👤' : bill.owner === 'shared' ? '👥' : '💬'}
              </button>
            )}
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

  const tableHead = (withPeriodCol = true) => (
    <thead>
      <tr className="bg-gray-50 dark:bg-gray-800/60 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <th className="py-2 px-3 font-medium">Payee</th>
        <th className="py-2 px-3 font-medium">Due</th>
        {withPeriodCol && <th className="py-2 px-3 font-medium">Planned</th>}
        <th className="py-2 px-3 font-medium text-right">Amount</th>
        <th className="py-2 px-3 w-20" />
      </tr>
    </thead>
  )

  const isKnownUnpaidDone = (_b: Bill) => false // placeholder hook for future rules

  const renderSection = (group: { title: string; items: Bill[]; total: number }) => {
    if (group.items.length === 0) return null
    const collapsed = collapsedSections.has(group.title)
    return (
      <div key={group.title}>
        <button
          type="button"
          onClick={() => toggleSection(group.title)}
          className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-6 mb-1 hover:text-blue-600 dark:hover:text-blue-400"
        >
          <span>Category: {group.title}</span>
          <span>{collapsed ? '▼' : '▲'}</span>
        </button>
        {!collapsed && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                {tableHead()}
                <tbody>{group.items.map(renderBillRow)}</tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
                    <td className="py-2 px-3 text-sm font-bold text-gray-900 dark:text-white" colSpan={3}>Total remaining</td>
                    <td className="py-2 px-3 text-right text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmt(group.total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Household Bills</h1>
          <p className="text-sm text-gray-500">Group by category, by pay period, or calendar — plan payments from each paycheck.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs" role="tablist" aria-label="Bill view mode">
            {([
              { key: 'category', label: 'Category', icon: ListFilter },
              { key: 'period', label: 'Pay Period', icon: Columns3 },
              { key: 'calendar', label: 'Calendar', icon: CalendarIcon },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3 py-2 font-medium transition-colors ${
                  view === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
          {!showForm && (
            <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true) }}>
              <PlusCircle className="w-4 h-4 mr-2" /> Add Bill
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <CardTitle className="text-base flex items-center gap-2"><ListFilter className="h-5 w-5 text-indigo-600 dark:text-indigo-300" /> Filter household bills</CardTitle>
            <Button variant="secondary" size="sm" disabled={!filtersActive} onClick={() => setFilters(EMPTY_BILL_FILTERS)}>Clear filters</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-medium">Payee
              <input type="search" aria-label="Filter by payee" value={filters.payee} onChange={e => setFilters(f => ({ ...f, payee: e.target.value }))} placeholder="Search payee name" className="mt-1 w-full min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
            </label>
            <label className="text-sm font-medium">Who&apos;s bill is it?
              <select aria-label="Filter by bill owner" value={filters.owner} onChange={e => setFilters(f => ({ ...f, owner: e.target.value }))} className="mt-1 w-full min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
                <option value="">Everyone</option><option value="me">Mine</option><option value="wife">Spouse&apos;s</option><option value="shared">Shared household</option>
              </select>
            </label>
            {([
              { title: 'Due', from: 'dueFrom', to: 'dueTo', type: 'date' },
              { title: 'Planned', from: 'plannedFrom', to: 'plannedTo', type: 'date' },
              { title: 'Amount', from: 'minAmount', to: 'maxAmount', type: 'number' },
            ] as const).map(range => <fieldset key={range.title} className="min-w-0"><legend className="text-sm font-medium">{range.title}</legend><div className="mt-1 grid grid-cols-2 gap-2">
              {([range.from, range.to] as const).map((field, i) => <label key={field} className="min-w-0 text-xs text-gray-600 dark:text-gray-300">{range.type === 'number' ? (i ? 'Maximum ($)' : 'Minimum ($)') : (i ? 'To' : 'From')}
                <input aria-label={`${range.title} ${range.type === 'number' ? (i ? 'maximum' : 'minimum') : (i ? 'to' : 'from')}`} type={range.type} min={range.type === 'number' ? '0' : undefined} step={range.type === 'number' ? '0.01' : undefined} placeholder={range.type === 'number' ? 'Any' : undefined} value={filters[field]} onChange={e => setFilters(f => ({ ...f, [field]: e.target.value }))} className="mt-1 w-full min-w-0 min-h-11 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
              </label>)}
            </div></fieldset>)}
          </div>
          <p role="status" aria-live="polite" className="mt-4 text-sm text-gray-600 dark:text-gray-300">Showing <strong>{visibleBills.length}</strong> of {bills.length} bills. {filtersActive ? 'Views and summary totals reflect these filters.' : 'Filters apply to all three views.'}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Bills with unknown amounts or dates will not match a range filter for that field. Planned filters use the planned payment date.</p>
        </CardContent>
      </Card>
      {filtersActive && visibleBills.length === 0 && <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100">No bills match these filters. Adjust the ranges or choose Clear filters.</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryChip icon={<Receipt className="w-5 h-5" />} label="Still to pay" value={fmt(totalUnpaid)} chip="chip-bills" />
        <SummaryChip icon={<Check className="w-5 h-5" />} label="Paid this month" value={fmt(totalPaidThisMonth)} chip="chip-income" />
        <SummaryChip icon={<CircleHelpIcon />} label="Unknown amounts" value={String(unknownAmounts)} chip="chip-savings" sub="Never counted as $0" />
        <SummaryChip icon={<Landmark className="w-5 h-5" />} label="Overdue / no date" value={`${overdueBills.length} / ${missingDates}`} chip="chip-spending" />
      </div>

      {notice && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 flex-shrink-0" /> {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {showForm && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-sm">{editing ? 'Edit Bill' : 'Add Bill'}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM) }}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Payee Name</label>
                  <input
                    type="text" required
                    value={form.payee_name}
                    onChange={(e) => setForm((f) => ({ ...f, payee_name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Electric Company"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Who&apos;s bill is it?</label>
                  <select
                    value={form.owner}
                    onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {OWNER_OPT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount <span className="text-gray-400">(leave unknown if not sure)</span></label>
                  <input
                    type="number" step="0.01" min="0"
                    required={form.amount_status !== 'missing'}
                    disabled={form.amount_status === 'missing'}
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount confidence</label>
                  <select
                    value={form.amount_status}
                    onChange={(e) => {
                      const v = e.target.value
                      setForm((f) => ({ ...f, amount_status: v, amount: v === 'missing' ? '' : f.amount }))
                    }}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {AMOUNT_STATUS_OPT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Planned payment date <span className="text-gray-400">(fund from an earlier paycheck)</span></label>
                  <input
                    type="date"
                    value={form.planned_payment_date}
                    onChange={(e) => setForm((f) => ({ ...f, planned_payment_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date confidence</label>
                  <select
                    value={form.due_date_status}
                    onChange={(e) => setForm((f) => ({ ...f, due_date_status: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {DUE_STATUS_OPT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white">
                    <input
                      type="checkbox"
                      checked={form.is_recurring}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        is_recurring: e.target.checked,
                        recurrence_type: e.target.checked && !f.recurrence_type ? 'monthly' : f.recurrence_type,
                      }))}
                      className="rounded"
                    />
                    Recurring
                  </label>
                  {form.is_recurring && (
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Repeats</label>
                      <select
                        value={form.recurrence_type || 'monthly'}
                        onChange={(e) => setForm((f) => ({ ...f, recurrence_type: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {RECURRENCE_OPTIONS.filter((o) => o.value !== '').map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Payment account <span className="text-gray-400">(which bank account pays it)</span></label>
                  <select
                    value={form.account}
                    onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— not set —</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.name}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Website URL</label>
                  <input
                    type="url"
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/bill-pay"
                  />
                </div>
                <div className="md:col-span-3">
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

      {/* ================= VIEWS ================= */}

      {view === 'category' && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-sm">By Category</CardTitle>
              <span className="text-xs text-gray-400">{visibleBills.length} bill{visibleBills.length !== 1 ? 's' : ''}</span>
            </div>
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
                        {tableHead()}
                        <tbody>{unmatched.map(renderBillRow)}</tbody>
                        <tfoot>
                          <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
                            <td className="py-2 px-3 text-sm font-bold text-gray-900 dark:text-white" colSpan={3}>Total remaining</td>
                            <td className="py-2 px-3 text-right text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                              {fmt(unmatched.reduce((s, b) => s + owed(b), 0))}
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
          </CardContent>
        </Card>
      )}

      {view === 'period' && (
        <div className="space-y-4">
          {anchor === '' && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              No payday anchor found yet — add an income schedule on the{' '}
              <Link href="/budget" className="underline">dashboard</Link> to group bills by pay periods.
            </p>
          )}
          {periodGroups.map((pg) => (
            <Card key={pg.window.start} className={`lift ${pg.hasCurrent ? 'ring-2 ring-blue-500/30 border-blue-300 dark:border-blue-700' : ''}`}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarDays className={`w-4 h-4 ${pg.hasCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                    {pg.window.label}
                    {pg.hasCurrent && <StatusPill status="info" label="Current" />}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Total:</span>
                    <span className="font-bold tabular-nums text-gray-900 dark:text-white">{fmt(pg.total)}</span>
                  </div>
                </div>
                {pg.items.length === 0 ? (
                  <p className="text-xs text-gray-400 py-3 text-center">No bills land in this window. Fund a future bill by setting an earlier planned payment date.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      {tableHead(false)}
                      <tbody>{pg.items.map(renderBillRow)}</tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {undefinedDateBills.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm mb-2">No date yet ({undefinedDateBills.length}) — not scheduled</CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  These bills are waiting on information, so they are intentionally NOT in any pay period and NOT counted in totals.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    {tableHead(false)}
                    <tbody>{undefinedDateBills.map(renderBillRow)}</tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {view === 'calendar' && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Button variant="secondary" size="sm" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}>←</Button>
              <CardTitle className="text-base">
                {calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </CardTitle>
              <Button variant="secondary" size="sm" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}>→</Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-400 uppercase">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell, i) => {
                const dayBills = cell.date ? billsOn(cell.date) : []
                const today = toDateString(new Date())
                const isToday = cell.date === today
                const overdue = cell.date && cell.date < today && dayBills.some(b => !b.is_paid)
                return (
                  <div
                    key={i}
                    className={`min-h-[72px] sm:min-h-[92px] rounded-lg border p-1 text-left ${
                      cell.date ? 'border-gray-200 dark:border-gray-700' : 'border-transparent'
                    } ${isToday ? 'ring-2 ring-blue-400' : ''} ${overdue ? 'bg-rose-50 dark:bg-rose-900/10' : ''}`}
                  >
                    {cell.dom > 0 && (
                      <div className={`text-[11px] font-semibold mb-0.5 ${isToday ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}>
                        {cell.dom}
                        {isToday && <span className="ml-1 text-[9px] uppercase">today</span>}
                      </div>
                    )}
                    {dayBills.map(b => (
                      <div
                        key={b.id}
                        className={`rounded px-1.5 py-0.5 mb-0.5 truncate text-[10px] font-medium ${
                          b.is_paid
                            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 line-through'
                            : b.amount_status === 'missing' || !(Number(b.amount) > 0)
                              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                              : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                        }`}
                        title={`${b.payee_name || 'Bill'}${b.is_paid ? ' (paid)' : ''}${effectivePayDate(b) && effectivePayDate(b) !== b.due_date ? ' — planned early' : ''}`}
                      >
                        {b.payee_name || 'Bill'}{b.is_paid ? ' ✓' : ''}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/40 inline-block" /> due/planned</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/40 inline-block" /> unknown amount</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/40 inline-block" /> paid</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Back link */}
      <Link href="/budget">
        <Button variant="secondary"><ArrowRight className="w-4 h-4 mr-2 rotate-180" /> Back to Pay-Period Dashboard</Button>
      </Link>
    </div>
  )
}

function SummaryChip({
  icon, label, value, chip, sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  chip: string
  sub?: string
}) {
  return (
    <Card className="lift">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{label}</p>
          <p className="text-lg sm:text-xl font-bold mt-0.5 text-gray-900 dark:text-white truncate">{value}</p>
          {sub && <p className="text-[10px] text-gray-400 truncate">{sub}</p>}
        </div>
        <div className={`chip ${chip} w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0`}>{icon}</div>
      </CardContent>
    </Card>
  )
}

function CircleHelpIcon() {
  return (
    <span className="text-lg" role="img" aria-hidden="true">❓</span>
  )
}
