'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet, CreditCard, TrendingUp, PlusCircle, ArrowRight,
  Landmark, WalletCards, Edit, Trash2, DollarSign, Upload, ExternalLink, Car,
  RefreshCw, Loader2, Receipt,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { PlaidLinkButton } from '@/components/PlaidLinkButton'

interface BankAccount {
  id: number
  name: string
  account_type: string
  institution?: string
  website?: string
  account_number_last4?: string
  current_balance: number
  is_active: number
  is_income_account: number
  interest_rate: number
  last_synced_at?: string | null
}

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const EMPTY_FORM = {
  name: '',
  account_type: 'checking',
  institution: '',
  website: '',
  account_number_last4: '',
  current_balance: '',
  is_income_account: false,
}

interface RecentTx {
  id: number
  account_id: number
  account_name: string
  date: string
  description: string
  amount: number
  balance: number
  plaid_transaction_id: string | null
}

function formatTxDate(v: string): string {
  const d = new Date(v)
  if (isNaN(d.getTime())) return v || '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(-2)}`
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function formatSyncedAt(v: string | null | undefined): string {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const yy = String(d.getFullYear()).slice(-2)
  let h = d.getHours()
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${mm}/${dd}/${yy} ${pad(h)}:${pad(d.getMinutes())}${ap}`
}

export default function BankAccountsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editBalance, setEditBalance] = useState('')
  const [editInstitution, setEditInstitution] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [error, setError] = useState('')
  const [txSyncing, setTxSyncing] = useState(false)
  const [txMessage, setTxMessage] = useState('')
  const [recentTx, setRecentTx] = useState<RecentTx[]>([])
  const [txLoading, setTxLoading] = useState(true)
  const autoSyncedRef = useRef(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/budget/bank-accounts')
    if (res.ok) {
      const data = await res.json()
      setAccounts(data.accounts)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (user) fetchAccounts()
  }, [user, fetchAccounts])

  const fetchRecentTx = useCallback(async () => {
    const res = await fetch('/api/budget/transactions?kind=bank&limit=10')
    if (res.ok) {
      const data = await res.json()
      setRecentTx(data.transactions)
    }
    setTxLoading(false)
  }, [])

  const runTransactionSync = useCallback(async (manually: boolean) => {
    setTxSyncing(true)
    setTxMessage('')
    if (manually) setError('')
    try {
      const res = await fetch('/api/budget/plaid/sync-transactions', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setTxMessage(data.message || 'Transactions synced')
        await fetchRecentTx()
        await fetchAccounts()
      } else if (manually) {
        setError(data.error || 'Transaction sync failed')
      }
    } catch {
      if (manually) setError('Transaction sync failed')
    }
    setTxSyncing(false)
  }, [fetchRecentTx, fetchAccounts])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/budget/transactions?kind=bank&limit=10')
        if (!cancelled && res.ok) setRecentTx((await res.json()).transactions)
      } finally {
        if (!cancelled) setTxLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!user || autoSyncedRef.current) return
    autoSyncedRef.current = true
    runTransactionSync(false)
  }, [user, runTransactionSync])

  const totalBalance = accounts.filter(a => a.account_type !== 'loan').reduce((sum, a) => sum + (a.current_balance || 0), 0)
  const totalLoans = accounts.filter(a => a.account_type === 'loan').reduce((sum, a) => sum + (a.current_balance || 0), 0)
  const bankAccounts = accounts.filter(a => a.account_type !== 'loan')
  const loanAccounts = accounts.filter(a => a.account_type === 'loan')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/budget/bank-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        account_type: form.account_type,
        institution: form.institution || null,
        website: form.website || null,
        account_number_last4: form.account_number_last4 || null,
        current_balance: parseFloat(form.current_balance) || 0,
        is_income_account: form.is_income_account ? 1 : 0,
        is_active: 1,
        interest_rate: 0,
      }),
    })
    if (res.ok) {
      setForm(EMPTY_FORM)
      setShowForm(false)
      fetchAccounts()
    }
    setSaving(false)
  }

  const startEdit = (account: BankAccount) => {
    setEditingId(account.id)
    setEditBalance(account.current_balance.toString())
    setEditInstitution(account.institution || '')
    setEditWebsite(account.website || '')
  }

  const saveEdit = async (id: number) => {
    const account = accounts.find((a) => a.id === id)
    if (!account) return
    const res = await fetch(`/api/budget/bank-accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: account.name,
        account_type: account.account_type,
        institution: editInstitution,
        website: editWebsite,
        account_number_last4: account.account_number_last4 || null,
        current_balance: parseFloat(editBalance) || 0,
        is_active: account.is_active,
        is_income_account: account.is_income_account,
        interest_rate: account.interest_rate || 0,
      }),
    })
    if (res.ok) {
      setEditingId(null)
      fetchAccounts()
    }
  }

  const deleteAccount = async (id: number) => {
    if (!confirm('Delete this account?')) return
    const res = await fetch(`/api/budget/bank-accounts/${id}`, { method: 'DELETE' })
    if (res.ok) fetchAccounts()
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
        await fetchAccounts()
      } else {
        setError(data.error || 'Sync failed')
      }
    } catch {
      setError('Sync failed')
    }
    setSyncing(false)
  }

  const accountIcon = (account: BankAccount) => {
    if (account.account_type === 'savings' || account.account_type === 'money_market') {
      return <TrendingUp className={`h-5 w-5 ${account.is_income_account ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
    }
    if (account.account_type === 'loan') {
      return <Car className={`h-5 w-5 ${account.is_income_account ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
    }
    return <CreditCard className={`h-5 w-5 ${account.is_income_account ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
  }

  const renderAccountGroups = (groupedAccounts: BankAccount[]) => (
    <div className="space-y-4">
      {Object.entries(
        groupedAccounts.reduce<Record<string, BankAccount[]>>((groups, account) => {
          const group = account.institution || 'Other'
          ;(groups[group] ||= []).push(account)
          return groups
        }, {})
      ).map(([groupName, groupAccounts]) => {
        const groupTotal = groupAccounts.reduce((s, a) => s + (Number(a.current_balance) || 0), 0)
        const groupWebsite = groupAccounts.find((a) => a.website)?.website || ''
        return (
          <div key={groupName}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-2 px-1">
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                <span>{groupAccounts.length} account{groupAccounts.length !== 1 ? 's' : ''}</span>
                <span>Bal: {fmt(groupTotal)}</span>
              </div>
            </div>
            <div className="space-y-3">
              {groupAccounts.map((account) => (
                <Card key={account.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className={`p-2.5 rounded-lg shrink-0 ${account.is_income_account ? 'bg-green-100 dark:bg-green-900/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
                {accountIcon(account)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-semibold text-gray-900 dark:text-white truncate max-w-full">{account.name}</p>
                  {account.is_income_account === 1 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400">
                      Income
                    </span>
                  )}
                  {account.account_type === 'loan' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400">
                      Loan
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {account.institution ? (
                    account.website ? (
                      <a href={normalizeUrl(account.website)} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{account.institution}</a>
                    ) : (
                      account.institution
                    )
                  ) : null}
                  {account.institution && account.account_number_last4 && <span className="mx-1">&middot;</span>}
                  {account.account_number_last4 && <span>****{account.account_number_last4}</span>}
                  {!account.institution && !account.account_number_last4 && (
                    <span className="capitalize">{account.account_type}</span>
                  )}
                  {account.institution && !account.account_number_last4 && (
                    <span className="ml-1 capitalize">&middot; {account.account_type}</span>
                  )}
                </p>
                {formatSyncedAt(account.last_synced_at) && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                    Last synced {formatSyncedAt(account.last_synced_at)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end shrink-0">
              {/* Balance / Edit */}
              {editingId === account.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => saveEdit(account.id)}
                    className="p-1.5 text-green-600 hover:text-green-700 dark:text-green-400 rounded"
                    title="Save"
                  >
                    <Wallet className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                    title="Cancel"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <p className={`text-lg font-bold text-right tabular-nums whitespace-nowrap ${account.current_balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    {fmt(account.current_balance)}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(account)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                      title="Edit account"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteAccount(account.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                      title="Delete account"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
            </div>

            {/* Inline edit fields */}
            {editingId === account.id && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_8rem] gap-2 w-full mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <input
                  type="text"
                  value={editInstitution}
                  onChange={(e) => setEditInstitution(e.target.value)}
                  placeholder="Institution"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                  placeholder="URL"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  step="0.01"
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-right text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Landmark className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bank Accounts</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PlaidLinkButton onConnected={fetchAccounts} />
          <Button onClick={handleSync} disabled={syncing || txSyncing} variant="secondary" size="sm">
            {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync Balances'}</span>
            <span className="sm:hidden">{syncing ? '...' : 'Sync'}</span>
          </Button>
          <Button onClick={() => runTransactionSync(true)} disabled={txSyncing || syncing} variant="secondary" size="sm">
            {txSyncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Receipt className="h-4 w-4 mr-1" />}
            <span className="hidden sm:inline">{txSyncing ? 'Syncing...' : 'Sync Transactions'}</span>
            <span className="sm:hidden">{txSyncing ? '...' : 'Txns'}</span>
          </Button>
          <Link href="/budget/import-statement">
            <Button variant="secondary" size="sm"><Upload className="h-4 w-4 mr-1" /> Import</Button>
          </Link>
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            <PlusCircle className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {syncMessage && (
        <div className="mb-4 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
          {syncMessage}
        </div>
      )}
      {txMessage && (
        <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <span className="inline-flex items-center gap-2">{txMessage}</span>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <Link
        href="/budget"
        className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
      >
        <ArrowRight className="h-3 w-3 rotate-180" /> Back to Budget
      </Link>

      {/* Total Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/40">
                <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Bank Balance</p>
                <p className={`text-2xl font-bold ${totalBalance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                  {fmt(totalBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/40">
                <Car className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Loan Balance</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{fmt(totalLoans)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Form */}
      {showForm && (
        <Card className="mb-6 border-blue-200 dark:border-blue-800">
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Account</h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Account Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Main Checking"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Account Type</label>
                <select
                  value={form.account_type}
                  onChange={(e) => setForm({ ...form, account_type: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="money_market">Money Market</option>
                  <option value="investment">Investment</option>
                  <option value="loan">Loan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Institution</label>
                <input
                  value={form.institution}
                  onChange={(e) => setForm({ ...form, institution: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Chase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Institution URL</label>
                <input
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. chase.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Last 4 Digits</label>
                <input
                  value={form.account_number_last4}
                  onChange={(e) => setForm({ ...form, account_number_last4: e.target.value.slice(0, 4) })}
                  maxLength={4}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1234"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Current Balance</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.current_balance}
                  onChange={(e) => setForm({ ...form, current_balance: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="is_income_account"
                  checked={form.is_income_account}
                  onChange={(e) => setForm({ ...form, is_income_account: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_income_account" className="text-sm text-gray-700 dark:text-gray-300">
                  Income Account
                </label>
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Create Account'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Accounts List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <WalletCards className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No bank accounts yet. Add one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bank Accounts</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">({bankAccounts.length})</span>
            </div>
            {bankAccounts.length > 0 ? (
              renderAccountGroups(bankAccounts)
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No bank accounts yet. Add one to get started.
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Car className="h-5 w-5 text-red-600 dark:text-red-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Loans</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">({loanAccounts.length})</span>
            </div>
            {loanAccounts.length > 0 ? (
              renderAccountGroups(loanAccounts)
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No loans yet. Add a loan account to track auto, student, or personal loans.
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="mt-8">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h2>
              <Button onClick={() => runTransactionSync(true)} disabled={txSyncing} variant="secondary" size="sm">
                {txSyncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                {txSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
            <Card>
              <CardContent className="p-5">
                {txLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  </div>
                ) : recentTx.length === 0 ? (
                  <div className="text-center py-8">
                    <Receipt className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No transactions yet. Link an account via Plaid and hit &quot;Sync Transactions&quot; to pull them in.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/60 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          <th className="py-2 px-3 font-medium">Date</th>
                          <th className="py-2 px-3 font-medium">Description</th>
                          <th className="py-2 px-3 font-medium">Account</th>
                          <th className="py-2 px-3 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentTx.map((tx) => (
                          <tr key={tx.id} className="border-t border-gray-100 dark:border-gray-800">
                            <td className="py-2 px-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                              {formatTxDate(tx.date)}
                            </td>
                            <td className="py-2 px-3 text-sm text-gray-900 dark:text-white truncate max-w-[260px]">
                              {tx.description || '—'}
                            </td>
                            <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400 truncate max-w-[180px]">
                              {tx.account_name}
                            </td>
                            <td className={`py-2 px-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap ${tx.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {fmt(tx.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
