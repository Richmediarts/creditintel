'use client'

import React from 'react'
import { ArrowLeft, Download, FileSpreadsheet, FileJson, Printer } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useCredit } from '@/lib/store/creditStore'

export default function ExportPage() {
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

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(creditData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `credit-report-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCSV = () => {
    let csv = 'Bureau,Creditor,Account Type,Balance,Credit Limit,Status,Date Opened\n'
    for (const report of creditData.reports) {
      for (const account of report.accounts) {
        csv += `${report.bureau},"${account.creditorName}",${account.accountType},${account.balance},${account.creditLimit || 0},${account.status},${account.dateOpened}\n`
      }
    }
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `credit-report-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const printReport = () => {
    window.print()
  }

  const exportDisputeSummary = () => {
    let text = 'DISPUTE SUMMARY\n'
    text += '='.repeat(50) + '\n\n'
    for (const item of creditData.disputeItems) {
      text += `Creditor: ${item.creditorName}\n`
      text += `Bureau: ${item.bureau}\n`
      text += `Inaccuracies: ${item.inaccuracies.join(', ')}\n`
      text += `Est. Score Gain: +${item.estimatedScoreGain} pts\n`
      text += '-'.repeat(30) + '\n'
    }
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dispute-summary-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Export Center</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={exportJSON}>
          <CardContent className="p-6 text-center">
            <FileJson className="w-10 h-10 mx-auto text-blue-500 mb-3" />
            <h3 className="font-medium text-gray-900 dark:text-white">Export JSON</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Full data in JSON format</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={exportCSV}>
          <CardContent className="p-6 text-center">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
            <h3 className="font-medium text-gray-900 dark:text-white">Export CSV</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Spreadsheet-compatible format</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={printReport}>
          <CardContent className="p-6 text-center">
            <Printer className="w-10 h-10 mx-auto text-purple-500 mb-3" />
            <h3 className="font-medium text-gray-900 dark:text-white">Print Report</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Print-friendly view</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={exportDisputeSummary}>
          <CardContent className="p-6 text-center">
            <Download className="w-10 h-10 mx-auto text-orange-500 mb-3" />
            <h3 className="font-medium text-gray-900 dark:text-white">Dispute Summary</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Text file with dispute items</p>
          </CardContent>
        </Card>
      </div>

      {creditData.reports.map(report => (
        <Card key={report.bureau}>
          <CardContent className="p-4">
            <CardTitle className="mb-3">{report.bureau} - {report.filename || 'Report'}</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {report.summary.totalAccounts} accounts &middot;
              {report.summary.hardInquiries} hard inquiries &middot;
              {report.summary.derogatoryAccounts} derogatory
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
