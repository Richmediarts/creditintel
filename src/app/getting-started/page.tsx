'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, Download, Upload, CheckCircle2, AlertCircle,
  Landmark, CreditCard, Receipt, Tag, Users, Banknote, BarChart3, ListChecks,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

interface ImportSummary {
  imported: number
  counts: Record<string, number>
  skipped: string[]
}

const SETUP_SECTIONS = [
  { href: '/upload', title: 'Credit Reports', desc: 'Upload your Experian, Equifax, and TransUnion PDFs to populate accounts, inquiries, and scores.', icon: FileText, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  { href: '/fico-scores', title: 'FICO® Scores', desc: 'Enter your current FICO scores for each bureau, or let them populate automatically after upload.', icon: BarChart3, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' },
  { href: '/budget/bank-accounts', title: 'Bank Accounts', desc: 'Add checking, savings, and loan accounts with balances. Link with Plaid to auto-sync.', icon: Landmark, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' },
  { href: '/budget/credit-cards', title: 'Credit Cards', desc: 'Add every card with limit, balance, and APR. See utilization at a glance.', icon: CreditCard, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400' },
  { href: '/budget/bills', title: 'Bills & Budget', desc: 'Create recurring bills and add them to your budget so nothing slips through.', icon: Receipt, color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400' },
  { href: '/budget/categories', title: 'Categories', desc: 'Organize spending into categories with monthly limits to track where money goes.', icon: Tag, color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400' },
  { href: '/budget/payees', title: 'Payees', desc: 'Keep a reusable list of who you pay, with optional category defaults.', icon: Users, color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' },
  { href: '/budget/paychecks', title: 'Paychecks', desc: 'Import your paystubs so income, deductions, and net pay are tracked every period.', icon: Banknote, color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400' },
]

export default function GettingStartedPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && result) {
      const t = setTimeout(() => {
        setResult(null)
        setFile(null)
      }, 4000)
      return () => clearTimeout(t)
    }
  }, [user, result])

  const handleImport = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Please select a CSV file to import.'); return }

    setSubmitting(true)
    setError(null)
    setResult(null)

    const fd = new FormData()
    fd.append('csv_file', file)

    try {
      const res = await fetch('/api/budget/setup-import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Import failed.'); setSubmitting(false); return }
      setResult(data)
      setFile(null)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [file])

  if (authLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ListChecks className="w-5 h-5" /> Getting Started
        </h1>
        <p className="text-sm text-gray-500">Set up your account in a few easy steps so every feature has data to work with.</p>
      </div>

      {/* Step-by-step instructions */}
      <Card>
        <CardContent className="p-5">
          <CardTitle className="text-sm mb-3">How to use RETTEEE CreditIntel</CardTitle>
          <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">1</span>
              <span><strong>Upload your credit reports.</strong> Get all three free at <a href="https://www.annualcreditreport.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">annualcreditreport.com</a>, then upload the PDFs in the <Link href="/upload" className="text-blue-600 dark:text-blue-400 underline">Upload Center</Link>. This powers the summary, report viewer, inquiries, disputes, and FICO pages.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">2</span>
              <span><strong>Set up your budget.</strong> Start with <Link href="/budget/bank-accounts" className="text-blue-600 dark:text-blue-400 underline">Bank Accounts</Link>, <Link href="/budget/credit-cards" className="text-blue-600 dark:text-blue-400 underline">Credit Cards</Link>, <Link href="/budget/bills" className="text-blue-600 dark:text-blue-400 underline">Bills</Link>, and <Link href="/budget/categories" className="text-blue-600 dark:text-blue-400 underline">Categories</Link>. Add everything manually, or use the bulk spreadsheet import below.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">3</span>
              <span><strong>Track income.</strong> Add your <Link href="/budget/paychecks" className="text-blue-600 dark:text-blue-400 underline">paychecks</Link> so reports and the interactive budget know your income and pay periods.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">4</span>
              <span><strong>Optional: link your bank.</strong> In <Link href="/budget/plaid-settings" className="text-blue-600 dark:text-blue-400 underline">Acct Link Settings</Link> configure your Plaid keys, then connect accounts to auto-sync balances and transactions.</span>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Quick setup links */}
      <Card>
        <CardContent className="p-5">
          <CardTitle className="text-sm mb-4">Set Up Your Accounts</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SETUP_SECTIONS.map((s) => (
              <Link key={s.href} href={s.href} className="group">
                <div className="h-full rounded-lg border border-gray-200 dark:border-gray-700 p-3.5 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className={`p-1.5 rounded-lg ${s.color}`}>
                      <s.icon className="w-4 h-4" />
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{s.title}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Spreadsheet import */}
      <Card>
        <CardContent className="p-5">
          <CardTitle className="text-sm mb-1">Import From Spreadsheet</CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Download the template, fill in your categories, payees, bank accounts, credit cards, bills, and paychecks, then upload it to add everything at once.
          </p>

          <div className="mb-4 flex flex-wrap gap-3">
            <a href="/templates/setup-template.csv" download>
              <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-2" /> Download Template (.csv)</Button>
            </a>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {result && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-300">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{result.imported} item{result.imported !== 1 ? 's' : ''} imported</p>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {Object.entries(result.counts).filter(([, n]) => n > 0).map(([k, n]) => `${k.replace(/_/g, ' ')}: ${n}`).join(' · ')}
                </div>
                {result.skipped.length > 0 && (
                  <ul className="list-disc list-inside mt-1 text-xs text-amber-600 dark:text-amber-400">
                    {result.skipped.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleImport} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <label className="flex-1 w-full sm:w-auto flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 cursor-pointer hover:border-blue-400">
              <Upload className="w-4 h-4" />
              {file ? <span className="truncate text-gray-900 dark:text-white">{file.name}</span> : <span>Choose CSV file…</span>}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setError(null); setResult(null) }} />
            </label>
            <Button type="submit" disabled={submitting || !file}>
              {submitting ? 'Importing…' : 'Import'}
            </Button>
          </form>

          <div className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p className="font-semibold text-gray-600 dark:text-gray-300">Template tips</p>
            <p>· The <code className="text-blue-600 dark:text-blue-400">type</code> column tells the app where each row goes: <code>category</code>, <code>payee</code>, <code>bank_account</code>, <code>credit_card</code>, <code>bill</code>, <code>paycheck</code>.</p>
            <p>· Leave unused columns blank. For bills, the <code>category</code> column links the bill to a matching category (it will be created if missing).</p>
            <p>· Open the file in Excel or Google Sheets, edit it, then export as CSV and upload here. Rows starting with <code>#</code> are ignored.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}