'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet, CreditCard, TrendingUp, PlusCircle, ArrowRight,
  Landmark, WalletCards, Edit, Trash2, DollarSign, Upload,
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
  account_number_last4?: string
  current_balance: number
  is_active: number
  is_income_account: number
  interest_rate: number
}

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const EMPTY_FORM = {
  name: '',
  account_type: 'checking',
  institution: '',
  account_number_last4: '',
  current_balance: '',
  is_income_account: false,
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
  const [saving, setSaving] = useState(false)

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

  const totalBalance = accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0)

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

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Landmark className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bank Accounts</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PlaidLinkButton onConnected={fetchAccounts} />
          <Link href="/budget/import-statement">
            <Button variant="secondary" size="sm"><Upload className="h-4 w-4 mr-1" /> Import</Button>
          </Link>
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            <PlusCircle className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      <Link
        href="/budget"
        className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
      >
        <ArrowRight className="h-3 w-3 rotate-180" /> Back to Budget
      </Link>

      {/* Total Balance */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/40">
              <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Balance</p>
              <p className={`text-2xl font-bold ${totalBalance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {fmt(totalBalance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
        <div className="space-y-4">
          {Object.entries(
            accounts.reduce<Record<string, BankAccount[]>>((groups, account) => {
              const group = account.institution || 'Other'
              ;(groups[group] ||= []).push(account)
              return groups
            }, {})
          ).map(([groupName, groupAccounts]) => {
            const groupTotal = groupAccounts.reduce((s, a) => s + (Number(a.current_balance) || 0), 0)
            return (
              <div key={groupName}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{groupName}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>{groupAccounts.length} account{groupAccounts.length !== 1 ? 's' : ''}</span>
                    <span>Bal: {fmt(groupTotal)}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {groupAccounts.map((account) => (
                    <Card key={account.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`p-2.5 rounded-lg ${account.is_income_account ? 'bg-green-100 dark:bg-green-900/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    {account.account_type === 'savings' ? (
                      <TrendingUp className={`h-5 w-5 ${account.is_income_account ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
                    ) : (
                      <CreditCard className={`h-5 w-5 ${account.is_income_account ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{account.name}</p>
                      {account.is_income_account === 1 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400">
                          Income
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {account.institution && <span>{account.institution}</span>}
                      {account.institution && account.account_number_last4 && <span className="mx-1">&middot;</span>}
                      {account.account_number_last4 && <span>****{account.account_number_last4}</span>}
                      {!account.institution && !account.account_number_last4 && (
                        <span className="capitalize">{account.account_type}</span>
                      )}
                      {account.institution && !account.account_number_last4 && (
                        <span className="ml-1 capitalize">&middot; {account.account_type}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Balance / Edit */}
                  {editingId === account.id ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        value={editInstitution}
                        onChange={(e) => setEditInstitution(e.target.value)}
                        placeholder="Institution"
                        className="w-full sm:w-36 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={editBalance}
                        onChange={(e) => setEditBalance(e.target.value)}
                        className="w-full sm:w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-right text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => saveEdit(account.id)}
                        className="p-1 text-green-600 hover:text-green-700 dark:text-green-400"
                        title="Save"
                      >
                        <Wallet className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Cancel"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <p className={`text-lg font-bold text-right min-w-[100px] ${account.current_balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                      {fmt(account.current_balance)}
                    </p>
                  )}

                  {/* Actions */}
                  {editingId !== account.id && (
                    <div className="flex items-center gap-1">
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
                  )}
                </div>
              </CardContent>
                </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
