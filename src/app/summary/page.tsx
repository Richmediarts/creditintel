'use client'

import React from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useCredit } from '@/lib/store/creditStore'
import { formatCurrency } from '@/lib/utils/analysis'
import type { Bureau } from '@/types'

const bureauColors: Record<Bureau, string> = {
  Experian: 'text-blue-600',
  Equifax: 'text-emerald-600',
  TransUnion: 'text-purple-600',
}

export default function SummaryPage() {
  const { state } = useCredit()
  const { creditData } = state

  if (!creditData) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <p>No credit data available. Upload reports first.</p>
        <Link href="/upload" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Go to Upload Center</Link>
      </div>
    )
  }

  const { reports, globalSummary } = creditData

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Credit Summary</h1>
      </div>

      {/* Global Summary */}
      <Card>
        <CardContent className="p-4">
          <CardTitle className="mb-4">Combined Credit Profile</CardTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryDetail label="Total Accounts" value={globalSummary.totalAccounts} />
            <SummaryDetail label="Open Accounts" value={globalSummary.totalOpen} />
            <SummaryDetail label="Closed Accounts" value={globalSummary.totalClosed} />
            <SummaryDetail label="Derogatory" value={globalSummary.totalDerogatory} variant={globalSummary.totalDerogatory > 0 ? 'danger' : 'default'} />
            <SummaryDetail label="Charge Offs" value={globalSummary.totalChargeOffs} variant={globalSummary.totalChargeOffs > 0 ? 'danger' : 'default'} />
            <SummaryDetail label="Collections" value={globalSummary.totalCollections} variant={globalSummary.totalCollections > 0 ? 'warning' : 'default'} />
            <SummaryDetail label="Late Accounts" value={globalSummary.totalLateAccounts} variant={globalSummary.totalLateAccounts > 0 ? 'warning' : 'default'} />
            <SummaryDetail label="Hard Inquiries" value={globalSummary.totalHardInquiries} />
            <SummaryDetail label="Soft Inquiries" value={globalSummary.totalSoftInquiries} />
            <SummaryDetail label="Public Records" value={globalSummary.totalPublicRecords} />
            <SummaryDetail label="Bankruptcies" value={globalSummary.totalBankruptcies} />
            <SummaryDetail label="Total Balance" value={formatCurrency(globalSummary.totalBalance)} />
          </div>
        </CardContent>
      </Card>

      {/* Credit Utilization Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <CardTitle>Credit Utilization</CardTitle>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {globalSummary.totalCreditUtilization.toFixed(1)}%
            </span>
          </div>
          <Progress value={globalSummary.totalCreditUtilization} variant={globalSummary.totalCreditUtilization > 50 ? 'danger' : globalSummary.totalCreditUtilization > 30 ? 'warning' : 'success'} className="h-4" showLabel />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Total Balance: {formatCurrency(globalSummary.totalBalance)}</span>
            <span>Total Limit: {formatCurrency(globalSummary.totalCreditLimit)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Per-Bureau Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reports.map(report => (
          <Card key={report.bureau}>
            <CardContent className="p-4">
              <CardTitle className={`mb-3 ${bureauColors[report.bureau]}`}>{report.bureau}</CardTitle>
              <div className="space-y-2 text-sm">
                <Row label="Total Accounts" value={report.summary.totalAccounts} />
                <Row label="Open" value={report.summary.openAccounts} />
                <Row label="Closed" value={report.summary.closedAccounts} />
                <Row label="Derogatory" value={report.summary.derogatoryAccounts} variant={report.summary.derogatoryAccounts > 0 ? 'danger' : 'default'} />
                <Row label="Charge Offs" value={report.summary.chargeOffs} variant={report.summary.chargeOffs > 0 ? 'danger' : 'default'} />
                <Row label="Collections" value={report.summary.collections} variant={report.summary.collections > 0 ? 'warning' : 'default'} />
                <Row label="Late Accounts" value={report.summary.lateAccounts} variant={report.summary.lateAccounts > 0 ? 'warning' : 'default'} />
                <Row label="Hard Inquiries" value={report.summary.hardInquiries} />
                <Row label="Balance" value={formatCurrency(report.summary.totalBalance)} />
                <Row label="Utilization" value={`${report.summary.creditUtilization.toFixed(1)}%`} variant={report.summary.creditUtilization > 50 ? 'danger' : 'default'} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function SummaryDetail({ label, value, variant = 'default' }: { label: string; value: string | number; variant?: 'default' | 'danger' | 'warning' }) {
  const colorMap = {
    default: 'text-gray-900 dark:text-white',
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
  }
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-lg font-bold ${colorMap[variant]}`}>{value}</p>
    </div>
  )
}

function Row({ label, value, variant = 'default' }: { label: string; value: string | number; variant?: 'default' | 'danger' | 'warning' }) {
  const colorMap = {
    default: 'text-gray-900 dark:text-white',
    danger: 'text-red-500',
    warning: 'text-yellow-500',
  }
  return (
    <div className="flex justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`font-medium ${colorMap[variant]}`}>{value}</span>
    </div>
  )
}
