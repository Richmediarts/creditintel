'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet, CreditCard, TrendingUp, PlusCircle, ArrowRight,
  Edit, Trash2, RefreshCw, Plug, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { PlaidLinkButton } from '@/components/PlaidLinkButton'

interface CreditCardType {
  id: number
  name: string
  last_four: string
  credit_limit: number
  current_balance: number
  interest_rate: number
  due_date: string
  plaid_account_id?: string
  plaid_item_id?: number
}

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const EMPTY_FORM = {
  name: '',
  last_four: '',
  credit_limit: '',
  current_balance: '',
  interest_rate: '',
  due_date: '',
}

export default function CreditCardsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [cards, setCards] = useState<CreditCardType[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CreditCardType | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  const fetchCards = useCallback(async () => {
    const res = await fetch('/api/budget/credit-cards', { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      setCards(data.cards)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchCards()
  }, [user, authLoading, fetchCards])

  const setField = (name: string, v: string) => setForm((f) => ({ ...f, [name]: v }))

  const startAdd = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startEdit = (card: CreditCardType) => {
    setEditing(card)
    setForm({
      name: card.name || '',
      last_four: card.last_four || '',
      credit_limit: String(card.credit_limit || ''),
      current_balance: String(card.current_balance || ''),
      interest_rate: String(card.interest_rate || ''),
      due_date: card.due_date || '',
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

    const payload = {
      name: form.name,
      last_four: form.last_four,
      credit_limit: Number(form.credit_limit) || 0,
      current_balance: Number(form.current_balance) || 0,
      interest_rate: Number(form.interest_rate) || 0,
      due_date: form.due_date,
    }

    const url = editing ? `/api/budget/credit-cards/${editing.id}` : '/api/budget/credit-cards'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(editing ? 'Card updated' : 'Card added')
      setEditing(null)
      setForm({ ...EMPTY_FORM })
      await fetchCards()
    } else {
      setError(data.error || 'Failed to save card')
    }
    setSaving(false)
  }

  const handleDelete = async (card: CreditCardType) => {
    if (!window.confirm(`Delete ${card.name}?`)) return
    const res = await fetch(`/api/budget/credit-cards/${card.id}`, { method: 'DELETE', cache: 'no-store' })
    if (res.ok) {
      setCards((prev) => prev.filter((c) => c.id !== card.id))
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage('')
    setError('')
    try {
      const res = await fetch('/api/budget/plaid/sync-balances', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        const ok = data.results?.filter((r: { status: string }) => r.status === 'ok').length || 0
        const fail = data.results?.filter((r: { status: string }) => r.status !== 'ok').length || 0
        setSyncMessage(`Synced ${ok} institution${ok !== 1 ? 's' : ''}${fail ? ` (${fail} failed)` : ''}`)
        await fetchCards()
      } else {
        setError(data.error || 'Sync failed')
      }
    } catch {
      setError('Sync failed')
    }
    setSyncing(false)
  }

  const totalDebt = cards.reduce((s, c) => s + (Number(c.current_balance) || 0), 0)
  const totalLimit = cards.reduce((s, c) => s + (Number(c.credit_limit) || 0), 0)
  const totalAvailable = totalLimit - totalDebt
  const avgUtil = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Credit Cards</h1>
          <p className="text-sm text-gray-500">Track balances, limits, and utilization across all your cards.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PlaidLinkButton onConnected={fetchCards} />
          <Button onClick={handleSync} disabled={syncing} variant="secondary" size="sm">
            {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync Balances'}</span>
            <span className="sm:hidden">{syncing ? '...' : 'Sync'}</span>
          </Button>
          {!editing && (
            <Button onClick={startAdd} size="sm"><PlusCircle className="w-4 h-4 mr-1" /> Add</Button>
          )}
        </div>
      </div>

      {message && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          {message}
        </div>
      )}
      {syncMessage && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
          {syncMessage}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-5">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">Total Debt</p>
            <p className={`text-lg sm:text-2xl font-bold mt-1 truncate ${totalDebt > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{fmt(totalDebt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-5">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">Available Credit</p>
            <p className={`text-lg sm:text-2xl font-bold mt-1 truncate ${totalAvailable > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>{fmt(totalAvailable)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-5">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">Total Credit Limit</p>
            <p className="text-lg sm:text-2xl font-bold mt-1 truncate text-gray-900 dark:text-white">{fmt(totalLimit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-5">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">Avg Utilization</p>
            <p className={`text-lg sm:text-2xl font-bold mt-1 truncate ${avgUtil > 30 ? 'text-red-500' : avgUtil > 0 ? 'text-amber-500' : 'text-gray-900 dark:text-white'}`}>
              {avgUtil.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit form */}
      {editing && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-sm">
                {editing ? `Edit ${editing.name}` : 'Add Credit Card'}
              </CardTitle>
              {editing && (
                <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setForm({ ...EMPTY_FORM }) }}>
                  <Trash2 className="w-4 h-4 mr-1" /> Cancel
                </Button>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Card Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Visa Platinum"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Last 4 Digits</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={form.last_four}
                    onChange={(e) => setField('last_four', e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1234"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Due Date</label>
                  <input
                    type="text"
                    value={form.due_date}
                    onChange={(e) => setField('due_date', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 15th"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Credit Limit</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.credit_limit}
                    onChange={(e) => setField('credit_limit', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Current Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.current_balance}
                    onChange={(e) => setField('current_balance', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Interest Rate (APR %)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.interest_rate}
                    onChange={(e) => setField('interest_rate', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <Button type="submit" disabled={saving}>
                  <Wallet className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Card'}
                </Button>
                <Link href="/budget">
                  <Button variant="secondary"><ArrowRight className="w-4 h-4 mr-2" /> Back to Dashboard</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Card list */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="text-sm">Your Cards</CardTitle>
            <span className="text-xs text-gray-400">{cards.length} card{cards.length !== 1 ? 's' : ''}</span>
          </div>

          {cards.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(
                cards.reduce<Record<string, CreditCardType[]>>((groups, card) => {
                  const group = card.name || 'Other'
                  ;(groups[group] ||= []).push(card)
                  return groups
                }, {})
              ).map(([groupName, groupCards]) => {
                const groupBalance = groupCards.reduce((s, c) => s + (Number(c.current_balance) || 0), 0)
                const groupLimit = groupCards.reduce((s, c) => s + (Number(c.credit_limit) || 0), 0)
                const groupAvail = groupLimit - groupBalance
                const groupUtil = groupLimit > 0 ? (groupBalance / groupLimit) * 100 : 0

                return (
                  <div key={groupName}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{groupName}</h3>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>{groupCards.length} card{groupCards.length !== 1 ? 's' : ''}</span>
                        <span>Bal: {fmt(groupBalance)}</span>
                        {groupLimit > 0 && <span>Util: {groupUtil.toFixed(0)}%</span>}
                      </div>
                    </div>
                    <div className="space-y-2">
                    {groupCards.map((card) => {
                      const limit = Number(card.credit_limit) || 0
                      const balance = Number(card.current_balance) || 0
                      const available = limit - balance
                      const util = limit > 0 ? (balance / limit) * 100 : 0
                      const utilColor = util > 30 ? 'text-red-500' : util > 10 ? 'text-amber-500' : 'text-green-500'
                      const utilBg = util > 30 ? 'bg-red-500' : util > 10 ? 'bg-amber-500' : 'bg-green-500'

                      return (
                        <div
                          key={card.id}
                          className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col md:flex-row md:items-center gap-4"
                        >
                          <div className="flex items-center gap-3 min-w-0 md:w-1/3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 shrink-0">
                              <CreditCard className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{card.name}</p>
                                {card.plaid_account_id && (
                                  <span title="Plaid connected"><Plug className="w-3 h-3 text-green-500 shrink-0" /></span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400">**** {card.last_four || '????'}{card.due_date ? ` · Due ${card.due_date}` : ''}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:w-2/3">
                            <div>
                              <p className="text-xs text-gray-400">Balance</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(balance)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Limit</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(limit)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Available</p>
                              <p className={`text-sm font-semibold ${available > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{fmt(available)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">APR</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{card.interest_rate ? `${Number(card.interest_rate)}%` : '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Utilization</p>
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-bold ${utilColor}`}>{util.toFixed(1)}%</p>
                                <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                  <div className={`h-full rounded-full ${utilBg}`} style={{ width: `${Math.min(util, 100)}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 md:ml-auto shrink-0">
                            <button
                              onClick={() => startEdit(card)}
                              className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(card)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No credit cards yet.</p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <PlaidLinkButton onConnected={fetchCards} />
                <Button onClick={startAdd}><PlusCircle className="w-4 h-4 mr-2" /> Add Manually</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
