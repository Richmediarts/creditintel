'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet, CreditCard, PlusCircle, ArrowRight, Edit, Trash2, ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

interface Payee {
  id: number
  name: string
  category?: string
  account_number?: string
  notes?: string
  website?: string
  default_category_id?: number
}

const EMPTY_FORM = {
  name: '',
  category: '',
  account_number: '',
  notes: '',
  website: '',
}

const CATEGORY_COLORS: Record<string, string> = {
  Utilities: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Credit Card': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Insurance: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Subscription: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Loan: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  Bank: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  Shopping: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  Healthcare: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  Other: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

function categoryColor(cat: string): string {
  if (!cat) return CATEGORY_COLORS.Other
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other
}

export default function PayeesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [payees, setPayees] = useState<Payee[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Payee | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const fetchPayees = useCallback(async () => {
    const res = await fetch('/api/budget/payees')
    if (res.ok) {
      const data = await res.json()
      setPayees(data.payees)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchPayees()
  }, [user, authLoading, fetchPayees])

  const setField = (name: string, value: string) => setForm((f) => ({ ...f, [name]: value }))

  const startAdd = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startEdit = (p: Payee) => {
    setEditing(p)
    setForm({
      name: p.name || '',
      category: p.category || '',
      account_number: p.account_number || '',
      notes: p.notes || '',
      website: p.website || '',
    })
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    const payload = { ...form }
    const url = editing ? `/api/budget/payees/${editing.id}` : '/api/budget/payees'
    const method = editing ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(editing ? 'Payee updated' : 'Payee added')
      setEditing(null)
      setForm({ ...EMPTY_FORM })
      await fetchPayees()
    } else {
      setError(data.error || 'Failed to save payee')
    }
    setSaving(false)
  }

  const handleDelete = async (p: Payee) => {
    if (!window.confirm(`Delete payee "${p.name}"?`)) return
    const res = await fetch(`/api/budget/payees/${p.id}`, { method: 'DELETE' })
    if (res.ok) {
      setMessage('Payee deleted')
      await fetchPayees()
    } else {
      setError('Failed to delete payee')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Payees</h1>
          <p className="text-sm text-gray-500">Manage your payees and payment recipients.</p>
        </div>
        {!editing && (
          <Button onClick={startAdd}><PlusCircle className="w-4 h-4 mr-2" /> Add Payee</Button>
        )}
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

      {(editing || !payees.length) && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-sm">
                {editing ? `Edit Payee — ${editing.name}` : 'Add Payee'}
              </CardTitle>
              {editing && (
                <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setForm({ ...EMPTY_FORM }) }}>
                  Cancel
                </Button>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Netflix, Visa, landlord"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setField('category', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Subscription">Subscription</option>
                    <option value="Loan">Loan</option>
                    <option value="Bank">Bank</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Account Number (Last 4)</label>
                  <input
                    type="text"
                    maxLength={20}
                    value={form.account_number}
                    onChange={(e) => setField('account_number', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 4321"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Website</label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => setField('website', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Payment due dates, account numbers, etc."
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Payee'}
                </Button>
                <Link href="/budget">
                  <Button variant="secondary">Back to Dashboard</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="text-sm">All Payees</CardTitle>
            <span className="text-xs font-medium text-gray-400">{payees.length} Payees</span>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Loading payees...</p>
            </div>
          ) : payees.length > 0 ? (
            <div className="space-y-3">
              {payees.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Wallet className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                        {p.category && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColor(p.category)}`}>
                            {p.category}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 ml-6">
                        {p.account_number && (
                          <span className="flex items-center gap-1">
                            <CreditCard className="w-3 h-3" /> ****{p.account_number.slice(-4)}
                          </span>
                        )}
                        {p.notes && (
                          <span className="truncate max-w-xs">{p.notes}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.website && (
                        <a
                          href={p.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-medium"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Visit
                        </a>
                      )}
                      <button
                        onClick={() => startEdit(p)}
                        className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="inline-flex items-center gap-1 text-red-500 text-xs font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Wallet className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No payees yet.</p>
              <Button onClick={startAdd} className="mt-3">
                <PlusCircle className="w-4 h-4 mr-2" /> Add your first payee
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
