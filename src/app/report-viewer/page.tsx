'use client'

import React, { useState } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCredit } from '@/lib/store/creditStore'
import { formatCurrency } from '@/lib/utils/analysis'
import type { Bureau, Account } from '@/types'

const bureauColors: Record<string, string> = {
  Experian: 'border-l-blue-500',
  Equifax: 'border-l-emerald-500',
  TransUnion: 'border-l-purple-500',
}

export default function ReportViewerPage() {
  const { state } = useCredit()
  const { creditData } = state
  const [selectedBureau, setSelectedBureau] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  if (!creditData) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <p>No credit data available. Upload reports first.</p>
        <Link href="/upload" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Go to Upload Center</Link>
      </div>
    )
  }

  const accounts: { bureau: Bureau; account: Account }[] = []
  for (const report of creditData.reports) {
    for (const account of report.accounts) {
      if (selectedBureau === 'all' || report.bureau === selectedBureau) {
        if (statusFilter === 'all' ||
          (statusFilter === 'open' && account.isOpen) ||
          (statusFilter === 'closed' && account.isClosed) ||
          (statusFilter === 'derogatory' && account.isDerogatory)) {
          if (!searchQuery || account.creditorName.toLowerCase().includes(searchQuery.toLowerCase())) {
            accounts.push({ bureau: report.bureau, account })
          }
        }
      }
    }
  }

  const bureaus = creditData.reports.map(r => r.bureau)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Interactive Report Viewer</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by creditor..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={selectedBureau}
              onChange={e => setSelectedBureau(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Bureaus</option>
              {bureaus.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="derogatory">Derogatory</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Account List */}
      <div className="space-y-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">{accounts.length} accounts found</p>
        {accounts.map(({ bureau, account }) => (
          <Card key={account.id} className={`border-l-4 ${bureauColors[bureau] || 'border-l-gray-300'}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">{account.creditorName}</h3>
                    <Badge variant={account.isDerogatory ? 'danger' : account.isOpen ? 'success' : 'default'}>
                      {account.status}
                    </Badge>
                    <Badge>{bureau}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>Balance: <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(account.balance)}</span></span>
                    {account.creditLimit && <span>Limit: <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(account.creditLimit)}</span></span>}
                    <span>Opened: <span className="font-medium text-gray-700 dark:text-gray-300">{account.dateOpened || 'N/A'}</span></span>
                    <span>Pay Status: <span className="font-medium text-gray-700 dark:text-gray-300">{account.payStatus || 'N/A'}</span></span>
                    <span>Type: <span className="font-medium text-gray-700 dark:text-gray-300">{account.accountType}</span></span>
                    <span>Acct #: <span className="font-medium text-gray-700 dark:text-gray-300">{account.accountNumber || 'N/A'}</span></span>
                  </div>
                </div>
              </div>
              {account.paymentHistory.length > 0 && (
                <div className="mt-3 flex gap-0.5 flex-wrap">
                  {account.paymentHistory.slice(-24).map((ph, j) => (
                    <div
                      key={j}
                      className={`w-3 h-6 rounded-sm ${ph.rating === 'OK' ? 'bg-green-400' : ph.rating === '30' ? 'bg-yellow-400' : ph.rating === '60' ? 'bg-orange-400' : ph.rating === '90' || ph.rating >= '120' ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                      title={`${ph.month} ${ph.year}: ${ph.rating}`}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
