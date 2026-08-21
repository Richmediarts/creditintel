'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet, CreditCard, TrendingUp, PlusCircle, ArrowRight,
  Edit, Trash2, RefreshCw, Plug, Loader2, ExternalLink, Link2,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { PlaidLinkButton } from '@/components/PlaidLinkButton'

interface CreditCardType {
  id: number
  name: string
  last_four: string
  institution?: string
  website?: string
  credit_limit: number
  current_balance: number
  interest_rate: number
  due_date: string
  plaid_account_id?: string
  plaid_item_id?: number
  is_active?: number
}

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const EMPTY_FORM = {
  name: '',
  last_four: '',
  institution: '',
  website: '',
  credit_limit: '',
  current_balance: '',
  interest_rate: '',
  due_date: '',
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

// Institution brand theme (card gradient + text colors + favicon domain)
interface CardTheme {
  gradient: string
  text: string
  subtext: string
  chip: string
  cardNo: string
}

const DEFAULT_THEME: CardTheme = {
  gradient: 'bg-gradient-to-br from-slate-700 via-gray-800 to-slate-950',
  text: 'text-white',
  subtext: 'text-white/70',
  chip: 'from-yellow-300 to-amber-500',
  cardNo: 'text-white',
}

const INSTITUTION_THEMES: Record<string, CardTheme> = {
  'apple card': {
    gradient: 'bg-gradient-to-br from-gray-100 via-white to-gray-300',
    text: 'text-gray-900',
    subtext: 'text-gray-500',
    chip: 'from-zinc-400 to-zinc-600',
    cardNo: 'text-gray-900',
  },
  'capital one': {
    gradient: 'bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950',
    text: 'text-white',
    subtext: 'text-blue-100/70',
    chip: 'from-yellow-300 to-amber-500',
    cardNo: 'text-white',
  },
  'credit one': {
    gradient: 'bg-gradient-to-br from-fuchsia-700 via-purple-800 to-purple-950',
    text: 'text-white',
    subtext: 'text-fuchsia-100/70',
    chip: 'from-amber-300 to-yellow-500',
    cardNo: 'text-white',
  },
  'concora credit': {
    gradient: 'bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-900',
    text: 'text-white',
    subtext: 'text-teal-100/70',
    chip: 'from-yellow-300 to-amber-500',
    cardNo: 'text-white',
  },
  'mission lane': {
    gradient: 'bg-gradient-to-br from-sky-600 via-blue-700 to-blue-950',
    text: 'text-white',
    subtext: 'text-sky-100/70',
    chip: 'from-yellow-300 to-amber-500',
    cardNo: 'text-white',
  },
  'navy federal credit union': {
    gradient: 'bg-gradient-to-br from-slate-800 via-blue-900 to-slate-950',
    text: 'text-white',
    subtext: 'text-blue-100/70',
    chip: 'from-amber-300 to-yellow-500',
    cardNo: 'text-white',
  },
  'onemain financial': {
    gradient: 'bg-gradient-to-br from-orange-500 via-red-600 to-red-800',
    text: 'text-white',
    subtext: 'text-orange-100/70',
    chip: 'from-yellow-300 to-amber-500',
    cardNo: 'text-white',
  },
  'synchrony': {
    gradient: 'bg-gradient-to-br from-yellow-500 via-amber-600 to-orange-700',
    text: 'text-white',
    subtext: 'text-yellow-100/70',
    chip: 'from-white/80 to-gray-200',
    cardNo: 'text-white',
  },
  'paypal': {
    gradient: 'bg-gradient-to-br from-blue-900 via-sky-900 to-slate-950',
    text: 'text-white',
    subtext: 'text-sky-100/70',
    chip: 'from-amber-300 to-yellow-500',
    cardNo: 'text-white',
  },
}

// Institution favicon domain (Google s2 favicon service; Clearbit API is discontinued)
const INSTITUTION_DOMAINS: Record<string, string> = {
  'capital one': 'capitalone.com',
  'mission lane': 'missionlane.com',
  'creditone': 'creditonebank.com',
  'credit one': 'creditonebank.com',
  'pnc': 'pnc.com',
  'navy federal credit union': 'navyfederal.org',
  'navy federal': 'navyfederal.org',
  'first tech': 'firsttechfed.com',
  'american express': 'americanexpress.com',
  'amex': 'americanexpress.com',
  'chase': 'chase.com',
  'bank of america': 'bankofamerica.com',
  'wells fargo': 'wellsfargo.com',
  'citi': 'citi.com',
  'citibank': 'citi.com',
  'discover': 'discover.com',
  'usaa': 'usaa.com',
  'goldman sachs': 'goldmansachs.com',
  'apple card': 'apple.com',
  'amazon': 'amazon.com',
  'synchrony': 'synchrony.com',
  'concora credit': 'concoracredit.myfinanceservice.com',
  'onemain financial': 'onemainfinancial.com',
  'paypal': 'paypal.com',
  'indigo': 'index.html',
  'petal': 'petalcard.com',
  'deserve': 'deserve.com',
  'jasper': 'jasper.com',
  'brex': 'brex.com',
  'ramp': 'ramp.com',
  'mercury': 'mercury.com',
  'charles schwab': 'schwab.com',
  'fidelity': 'fidelity.com',
  'ally': 'ally.com',
  'sofi': 'sofi.com',
  'marcus': 'marcus.com',
  'barclays': 'barclays.com',
  'hsbc': 'hsbc.com',
  'td bank': 'tdbank.com',
  'us bank': 'usbank.com',
  'truist': 'truist.com',
  'chime': 'chime.com',
  'current': 'current.com',
  'varomoney': 'varo.com',
  'green dot': 'greendot.com',
  'netspend': 'netspend.com',
  'cash app': 'cash.app',
  'walmart moneycard': 'walmartmoneycard.com',
}

function getCardTheme(institution: string, name: string): CardTheme {
  const key = (institution || name || '').toLowerCase().trim()
  return INSTITUTION_THEMES[key] || DEFAULT_THEME
}

function getLogoDomain(name: string): string {
  const key = name.toLowerCase().trim()
  const domain = INSTITUTION_DOMAINS[key]
  if (domain) return domain
  return key.replace(/[^a-z0-9.]/g, '').replace(/^\.+/, '') + '.com'
}

const LOCAL_LOGO_OVERRIDES: Record<string, string> = {
  'concora credit': '/card-logos/concora.png',
  'concora': '/card-logos/concora.png',
}

function getInstitutionLogoUrl(name: string): string {
  const key = name.toLowerCase().trim()
  const local = LOCAL_LOGO_OVERRIDES[key]
  if (local) return local
  return `https://www.google.com/s2/favicons?domain=${getLogoDomain(name)}&sz=128`
}

function fallbackInitialSvg(name: string): string {
  const letter = (name.trim().charAt(0) || 'C').toUpperCase()
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="24" fill="#ffffff"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui" font-size="64" font-weight="bold" fill="#334155">${letter}</text></svg>`)}`
}

const logoOnError = (e: React.SyntheticEvent<HTMLImageElement>, name: string) => {
  e.currentTarget.onerror = null
  e.currentTarget.src = fallbackInitialSvg(name)
}

export default function CreditCardsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [cards, setCards] = useState<CreditCardType[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CreditCardType | 'new' | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [urlEditingId, setUrlEditingId] = useState<number | null>(null)
  const [editWebsite, setEditWebsite] = useState('')
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
    setEditing('new')
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
      institution: card.institution || '',
      website: card.website || '',
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
      institution: form.institution,
      website: form.website,
      credit_limit: Number(form.credit_limit) || 0,
      current_balance: Number(form.current_balance) || 0,
      interest_rate: Number(form.interest_rate) || 0,
      due_date: form.due_date,
    }

    const isNew = !editing || editing === 'new'
    const url = editing && editing !== 'new' ? `/api/budget/credit-cards/${editing.id}` : '/api/budget/credit-cards'
    const method = isNew ? 'POST' : 'PUT'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(isNew ? 'Card added' : 'Card updated')
      setEditing(null)
      setForm({ ...EMPTY_FORM })
      await fetchCards()
    } else {
      setError(data.error || 'Failed to save card')
    }
    setSaving(false)
  }

  const saveCardUrl = async (id: number) => {
    const card = cards.find((c) => c.id === id)
    if (!card) return
    const res = await fetch(`/api/budget/credit-cards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: card.name,
        last_four: card.last_four,
        institution: card.institution || '',
        website: editWebsite,
        credit_limit: Number(card.credit_limit) || 0,
        current_balance: Number(card.current_balance) || 0,
        interest_rate: Number(card.interest_rate) || 0,
        due_date: card.due_date || '',
        is_active: card.is_active !== undefined ? card.is_active : 1,
        plaid_account_id: card.plaid_account_id || null,
        plaid_item_id: card.plaid_item_id || null,
      }),
    })
    if (res.ok) {
      setUrlEditingId(null)
      await fetchCards()
    }
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
        const fail = data.results?.filter((r: { status: string }) => r.status === 'error').length || 0
        const skipped = data.results?.filter((r: { status: string }) => r.status === 'skipped').length || 0
        setSyncMessage(`Synced ${ok} institution${ok !== 1 ? 's' : ''}${fail ? ` (${fail} failed)` : ''}${skipped ? ` (${skipped} disconnected, ignored)` : ''}`)
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
                {editing && editing !== 'new' ? `Edit ${editing.name}` : 'Add Credit Card'}
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
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Institution</label>
                  <input
                    type="text"
                    value={form.institution}
                    onChange={(e) => setField('institution', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Capital One"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Institution URL</label>
                  <input
                    type="text"
                    value={form.website}
                    onChange={(e) => setField('website', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. capitalone.com"
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
                  <Wallet className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : !editing || editing === 'new' ? 'Add Card' : 'Save Changes'}
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
            <div className="space-y-6">
              {Object.entries(
                cards.reduce<Record<string, CreditCardType[]>>((groups, card) => {
                  const group = card.institution || card.name || 'Other'
                  ;(groups[group] ||= []).push(card)
                  return groups
                }, {})
              ).map(([groupName, groupCards]) => {
                const groupBalance = groupCards.reduce((s, c) => s + (Number(c.current_balance) || 0), 0)
                const groupLimit = groupCards.reduce((s, c) => s + (Number(c.credit_limit) || 0), 0)
                const groupAvail = groupLimit - groupBalance
                const groupUtil = groupLimit > 0 ? (groupBalance / groupLimit) * 100 : 0
                const groupWebsite = groupCards.find((c) => c.website)?.website || ''

                return (
                  <div key={groupName}>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {groupWebsite ? (
                          <a
                            href={normalizeUrl(groupWebsite)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {groupName}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          groupName
                        )}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>{groupCards.length} card{groupCards.length !== 1 ? 's' : ''}</span>
                        <span>Bal: {fmt(groupBalance)}</span>
                        {groupLimit > 0 && <span>Util: {groupUtil.toFixed(0)}%</span>}
                        <span className="text-green-600 dark:text-green-400 hidden sm:inline">Avail: {fmt(groupAvail)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4">
                      {groupCards.map((card) => {
                        const limit = Number(card.credit_limit) || 0
                        const balance = Number(card.current_balance) || 0
                        const available = limit - balance
                        const util = limit > 0 ? (balance / limit) * 100 : 0
                        const utilColor = util > 30 ? 'text-red-500' : util > 10 ? 'text-amber-500' : 'text-green-500'
                        const utilBg = util > 30 ? 'bg-red-500' : util > 10 ? 'bg-amber-500' : 'bg-green-500'
                        const theme = getCardTheme(card.institution || '', card.name)
                        const logoUrl = getInstitutionLogoUrl(card.institution || card.name)
                        const cardholder = user?.name || card.name
                        const numDisplay = `••••  ••••  ••••  ${card.last_four ? card.last_four.padStart(4, '•') : '••••'}`

                        return (
                          <div key={card.id} className="flex flex-col w-[500px] max-w-full">
                            {/* Card mockup */}
                            <div className="rounded-2xl p-[1px] bg-gradient-to-br from-white/50 dark:from-white/15 via-transparent to-black/10 shadow-inner max-w-[500px] mx-auto lg:mx-0">
                              <div className={`relative overflow-hidden rounded-[15px] p-4 sm:p-5 aspect-[400/253] flex flex-col justify-between bg-gradient-to-br ${theme.gradient} shadow-lg`}>
                                {/* Watermark logo */}
                                <img
                                  src={logoUrl}
                                  alt=""
                                  aria-hidden
                                  onError={(e) => logoOnError(e, card.institution || card.name)}
                                  className="absolute -right-8 -bottom-10 w-48 h-48 object-contain opacity-25 pointer-events-none select-none -scale-x-100"
                                />
                                {/* Sheen */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/15 pointer-events-none" />

                                <div className="relative z-[1] flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="h-12 w-12 shrink-0 rounded-lg bg-white/95 dark:bg-white/90 p-1 border border-black/5 shadow-sm">
                                      <img
                                        src={logoUrl}
                                        alt={`${card.name} logo`}
                                        onError={(e) => logoOnError(e, card.institution || card.name)}
                                        className="w-full h-full object-contain rounded"
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <p className={`text-xl font-bold truncate ${theme.text}`}>{groupName}</p>
                                      <p className={`text-base truncate ${theme.subtext}`}>{card.name}</p>
                                    </div>
                                  </div>
                                  {card.plaid_account_id && (
                                    <span title="Plaid connected"><Plug className="w-4 h-4 text-green-400 shrink-0" /></span>
                                  )}
                                </div>

                                <div>
                                  <div className={`h-9 w-14 rounded-md bg-gradient-to-br ${theme.chip} border border-black/10 shadow-inner`} />
                                  <p className={`mt-2.5 font-mono tracking-[0.16em] text-base sm:text-xl font-semibold ${theme.cardNo}`}>{numDisplay}</p>
                                </div>

                                <div className="relative z-[1] flex items-end justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className={`text-[11px] uppercase tracking-wider ${theme.subtext}`}>Cardholder</p>
                                    <p className={`text-lg font-semibold truncate ${theme.text}`}>{cardholder}</p>
                                    <p className={`text-sm mt-0.5 ${theme.subtext}`}>{card.due_date ? `Due ${card.due_date}` : ''}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className={`text-[11px] uppercase tracking-wider ${theme.subtext}`}>APR</p>
                                    <p className={`text-lg font-bold ${theme.text}`}>{card.interest_rate ? `${Number(card.interest_rate).toFixed(2)}%` : '—'}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Detail footer */}
                            <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex-1">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                                <div>
                                  <p className="text-xs text-gray-400">Balance</p>
                                  <p className={`text-xl font-bold ${balance > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{fmt(balance)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400">Limit</p>
                                  <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(limit)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400">Available</p>
                                  <p className={`text-xl font-bold ${available > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{fmt(available)}</p>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                  <p className="text-xs text-gray-400">Utilization</p>
                                  <div className="flex items-center gap-2">
                                    <p className={`text-xl font-bold ${utilColor}`}>{util.toFixed(1)}%</p>
                                    <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                      <div className={`h-full rounded-full ${utilBg}`} style={{ width: `${Math.min(util, 100)}%` }} />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
                                {urlEditingId === card.id && card.website ? (
                                  <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                                    <input
                                      type="text"
                                      value={editWebsite}
                                      onChange={(e) => setEditWebsite(e.target.value)}
                                      placeholder="capitalone.com"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveCardUrl(card.id)
                                        if (e.key === 'Escape') setUrlEditingId(null)
                                      }}
                                      className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button onClick={() => saveCardUrl(card.id)} className="text-xs text-green-600 hover:underline">Save</button>
                                    <button onClick={() => setUrlEditingId(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 truncate">
                                    {card.website ? (
                                      <a href={normalizeUrl(card.website)} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                                        Manage online <ExternalLink className="w-3 h-3" />
                                      </a>
                                    ) : 'No website linked'}
                                  </span>
                                )}

                                <div className="flex items-center gap-1 ml-auto shrink-0">
                                  <button
                                    onClick={() => {
                                      setUrlEditingId(urlEditingId === card.id ? null : card.id)
                                      setEditWebsite(card.website || '')
                                    }}
                                    title="Edit institution URL"
                                    className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  >
                                    <Link2 className="w-4 h-4" />
                                  </button>
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