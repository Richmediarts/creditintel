'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Upload, FileText, ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

interface BankAccount {
  id: number
  name: string
  account_type: string
  institution: string
  last4: string
  balance: number
}

export default function ImportStatementPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [accountId, setAccountId] = useState<string>('')
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ imported: number; duplicates: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('checking')
  const [newInstitution, setNewInstitution] = useState('')
  const [newLast4, setNewLast4] = useState('')
  const [newBalance, setNewBalance] = useState('')

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/budget/bank-accounts')
      const data = await res.json()
      setAccounts(data.accounts || [])
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (user) fetchAccounts()
  }, [user, fetchAccounts])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  const handleSelectAccount = (id: string) => {
    setAccountId(id)
    if (id) setNewName('')
  }

  const handleNewNameChange = (val: string) => {
    setNewName(val)
    if (val) setAccountId('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Please select a file.'); return }
    if (!accountId && !newName.trim()) { setError('Select an existing account or enter a name for a new one.'); return }

    setSubmitting(true)
    setError(null)
    setResult(null)

    const fd = new FormData()
    fd.append('csv_file', file)
    fd.append('skip_duplicates', skipDuplicates ? 'on' : 'off')

    if (accountId) {
      fd.append('account_id', accountId)
    }
    if (!accountId) {
      fd.append('new_name', newName.trim())
      fd.append('new_type', newType)
      fd.append('new_institution', newInstitution.trim())
      fd.append('new_last4', newLast4.trim())
      fd.append('new_balance', newBalance || '0')
    }

    try {
      const res = await fetch('/api/budget/statement-import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Import failed.'); setSubmitting(false); return }
      setResult(data)
      setTimeout(() => router.push('/budget/bank-accounts'), 2000)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/budget" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400">
          <ArrowLeft className="w-4 h-4" /> Back to Budget
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Bank Statement</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Upload a CSV or PDF bank statement to import transactions.</p>
        </div>

        {result && (
          <Card className="border-green-300 dark:border-green-700">
            <CardContent>
              <p className="text-green-700 dark:text-green-400 font-medium">Import complete. Redirecting...</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {result.imported} imported, {result.duplicates} duplicates skipped, {result.total} total found.
              </p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-red-300 dark:border-red-700">
            <CardContent>
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* File */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Statement File</label>
                <label className="flex items-center gap-3 w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-4 py-6 cursor-pointer hover:border-blue-400 transition-colors">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {file ? file.name : 'Click to select CSV or PDF'}
                  </span>
                  <input
                    type="file"
                    accept=".csv,.pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
                {file && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <FileText className="w-4 h-4" />
                    {file.name}
                    <button type="button" onClick={() => setFile(null)} className="text-red-500 hover:underline ml-1">Remove</button>
                  </div>
                )}
              </div>

              {/* Skip duplicates */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Skip duplicate transactions</span>
              </label>

              {/* Target account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Account</label>
                <select
                  value={accountId}
                  onChange={(e) => handleSelectAccount(e.target.value)}
                  disabled={!!newName.trim()}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">-- Select existing account --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.account_type}) ****{a.last4}</option>
                  ))}
                </select>
              </div>

              {/* New account fields */}
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Or create a new account</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Account Name</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => handleNewNameChange(e.target.value)}
                      disabled={!!accountId}
                      placeholder="e.g. Chase Checking"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      disabled={!!accountId}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="cash">Cash</option>
                      <option value="investment">Investment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Institution</label>
                    <input
                      type="text"
                      value={newInstitution}
                      onChange={(e) => setNewInstitution(e.target.value)}
                      disabled={!!accountId}
                      placeholder="e.g. Chase"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Last 4 digits</label>
                    <input
                      type="text"
                      value={newLast4}
                      onChange={(e) => setNewLast4(e.target.value)}
                      disabled={!!accountId}
                      maxLength={4}
                      placeholder="1234"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Balance</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newBalance}
                      onChange={(e) => setNewBalance(e.target.value)}
                      disabled={!!accountId}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <Button type="submit" disabled={submitting || !file} className="w-full">
                {submitting ? 'Importing...' : 'Import Transactions'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
