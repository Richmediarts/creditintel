'use client'

import React from 'react'
import { ArrowLeft, GitCompare } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCredit } from '@/lib/store/creditStore'
import type { BureauReport, Account, Inquiry } from '@/types'

function formatBalance(n: number): string {
  if (n === 0) return '$0'
  return '$' + n.toLocaleString('en-US')
}

const bureauColors: Record<string, { border: string; text: string; bg: string }> = {
  TransUnion: { border: 'border-t-[#005b9f]', text: 'text-[#005b9f]', bg: 'bg-[#e8f0fe]' },
  Experian: { border: 'border-t-[#0f7c3f]', text: 'text-[#0f7c3f]', bg: 'bg-[#e6f4ea]' },
  Equifax: { border: 'border-t-[#e30613]', text: 'text-[#e30613]', bg: 'bg-[#fce8ea]' },
}

function BadgeTag({ label, variant }: { label: string; variant: 'derog' | 'ok' | 'warn' | 'chargeoff' | 'late' | 'settled' }) {
  const styles = {
    derog: 'bg-[#fce8ea] text-[#d93025]',
    ok: 'bg-[#e6f4ea] text-[#1e8e3e]',
    warn: 'bg-[#fef7e0] text-[#b06000]',
    chargeoff: 'bg-[#fce8ea] text-[#c5221f] font-bold',
    late: 'bg-[#fce8ea] text-[#d93025]',
    settled: 'bg-[#fef7e0] text-[#b06000]',
  }
  return <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded ml-1.5 whitespace-nowrap ${styles[variant]}`}>{label}</span>
}

function AccountRow({ name, balance, badges }: { name: string; balance: string; badges?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-100 last:border-b-0 text-sm gap-1.5">
      <span className="font-medium truncate flex-1 min-w-0">{name}</span>
      <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
        {balance}
        {badges}
      </span>
    </div>
  )
}

function DerogItem({ name, detail }: { name: React.ReactNode; detail?: string }) {
  return (
    <div className="py-1.5 border-b border-gray-100 last:border-b-0 text-sm">
      <div className="font-medium">{name}</div>
      {detail && <div className="text-xs text-gray-500 mt-0.5">{detail}</div>}
    </div>
  )
}

function getAccountBadges(acc: Account): React.ReactNode {
  const badges: React.ReactNode[] = []
  const ps = acc.payStatus.toLowerCase()
  const remarks = (acc.remarks || '').toLowerCase()
  if (acc.isChargeOff) badges.push(<BadgeTag key="co" label="CHARGE-OFF" variant="chargeoff" />)
  else if (acc.isCollection) badges.push(<BadgeTag key="col" label="COLLECTION" variant="derog" />)
  if (remarks.includes('settled') || remarks.includes('less than full')) badges.push(<BadgeTag key="stl" label="Settled" variant="settled" />)
  if (acc.isLate && !acc.isChargeOff) badges.push(<BadgeTag key="late" label={ps.includes('30') ? '30d late' : ps.includes('60') ? '60d late' : ps.includes('90') ? '90d late' : 'Late'} variant="late" />)
  if (remarks.includes('deferred') || ps.includes('deferred')) badges.push(<BadgeTag key="def" label="Deferred" variant="ok" />)
  return badges.length > 0 ? <>{badges}</> : null
}

function BureauColumn({ report }: { report: BureauReport }) {
  const colors = bureauColors[report.bureau] || { border: '', text: '', bg: '' }
  const { summary, accounts, inquiries } = report

  const openAccounts = accounts.filter(a => a.isOpen && a.balance > 0)
  const closedAccounts = accounts.filter(a => !a.isOpen || a.balance === 0)
  const derogAccounts = accounts.filter(a => a.isDerogatory)
  const hardInquiries = inquiries.filter(i => i.type === 'Hard')

  const summaryCard = (num: number | string, label: string, warn = false) => (
    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
      <span className={`text-xl font-bold block ${warn ? 'text-[#d93025]' : ''}`}>{num}</span>
      <span className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</span>
    </div>
  )

  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border-t-4 ${colors.border}`}>
      <h2 className={`text-lg font-bold pb-2.5 mb-3.5 border-b-2 ${colors.text}`} style={{ borderColor: 'currentColor' }}>{report.bureau}</h2>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {summaryCard(summary.totalAccounts, 'Accounts', summary.totalAccounts > 20)}
        {summaryCard(summary.derogatoryAccounts, 'Derogatory', summary.derogatoryAccounts > 0)}
        {summaryCard(summary.hardInquiries, 'Hard Inq', summary.hardInquiries > 5)}
      </div>

      <div className="sticky top-0 bg-white text-xs font-semibold text-gray-500 uppercase tracking-wide py-1 border-b border-gray-200 mb-2">Open Accounts</div>
      {openAccounts.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-2">None</p>
      ) : (
        openAccounts.map(acc => (
          <AccountRow
            key={acc.id}
            name={acc.creditorName}
            balance={formatBalance(acc.balance)}
            badges={getAccountBadges(acc)}
          />
        ))
      )}

      <div className="sticky top-0 bg-white text-xs font-semibold text-gray-500 uppercase tracking-wide py-1 border-b border-gray-200 mb-2 mt-4">Closed / Paid Accounts</div>
      {closedAccounts.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-2">None</p>
      ) : (
        closedAccounts.map(acc => (
          <AccountRow
            key={acc.id}
            name={acc.creditorName}
            balance={formatBalance(acc.balance)}
            badges={getAccountBadges(acc)}
          />
        ))
      )}

      {derogAccounts.length > 0 && (
        <>
          <div className="sticky top-0 bg-white text-xs font-semibold text-gray-500 uppercase tracking-wide py-1 border-b border-gray-200 mb-2 mt-4">Derogatory Items</div>
          {derogAccounts.map(acc => {
            const details: string[] = []
            if (acc.balance > 0) details.push(formatBalance(acc.balance) + ' balance')
            if (acc.dateClosed) details.push('Closed ' + acc.dateClosed)
            if (acc.estimatedRemovalDate) details.push('Removes ' + acc.estimatedRemovalDate)
            if (acc.remarks) details.push(acc.remarks)
            return (
              <DerogItem
                key={acc.id}
                name={<>{acc.creditorName} {getAccountBadges(acc)}</>}
                detail={details.length > 0 ? details.join(' • ') : undefined}
              />
            )
          })}
        </>
      )}

      <div className="sticky top-0 bg-white text-xs font-semibold text-gray-500 uppercase tracking-wide py-1 border-b border-gray-200 mb-2 mt-4">
        Inquiries <span className="font-bold" style={{ color: hardInquiries.length > 5 ? '#d93025' : '#1e8e3e' }}>{hardInquiries.length} hard</span>
      </div>
      {hardInquiries.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-2">None</p>
      ) : (
        <div className="text-xs text-gray-500 max-h-72 overflow-y-auto">
          {hardInquiries.map((inq, i) => (
            <div key={i}>{inq.creditorName} ({inq.date})</div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ComparisonPage() {
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

  const { reports } = creditData

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <GitCompare className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Upload at least one bureau report to see comparison</p>
        </CardContent>
      </Card>
    )
  }

  // Cross-bureau summary
  const allChargeOffs = reports.map(r => ({
    bureau: r.bureau,
    items: r.accounts.filter(a => a.isChargeOff).map(a => ({ name: a.creditorName, balance: a.balance })),
  }))
  const allSettled = reports.map(r => ({
    bureau: r.bureau,
    items: r.accounts.filter(a => (a.remarks || '').toLowerCase().includes('less than full') || (a.remarks || '').toLowerCase().includes('settled')).map(a => a.creditorName),
  }))
  const allLate = reports.map(r => ({
    bureau: r.bureau,
    items: r.accounts.filter(a => a.isLate && !a.isChargeOff && !a.isCollection).map(a => ({ name: a.creditorName, detail: a.isLate ? '30d' : '' })),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Credit Report Comparison</h1>
          <p className="text-sm text-gray-500">Richard L. Johnson &bull; Reports as of June 2026</p>
        </div>
      </div>

      {/* Three-bureau columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reports.map(report => (
          <BureauColumn key={report.bureau} report={report} />
        ))}
      </div>

      {/* Cross-Bureau Summary */}
      <Card>
        <CardContent className="p-5">
          <CardTitle className="mb-3">Cross-Bureau Summary</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-1">Item</th>
                  {reports.map(r => {
                    const c = bureauColors[r.bureau]
                    return <th key={r.bureau} className={`text-center py-2 px-1 ${c.text}`}>{r.bureau}</th>
                  })}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-1 font-medium">Total Accounts</td>
                  {reports.map(r => <td key={r.bureau} className="text-center py-2 px-1">{r.summary.totalAccounts}</td>)}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-1 font-medium">Derogatory Items</td>
                  {reports.map(r => <td key={r.bureau} className="text-center py-2 px-1 font-bold text-[#d93025]">{r.summary.derogatoryAccounts}</td>)}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-1 font-medium">Charge-offs</td>
                  {reports.map(r => {
                    const cos = r.accounts.filter(a => a.isChargeOff)
                    return (
                      <td key={r.bureau} className="text-center py-2 px-1 text-xs">
                        {cos.length === 0 ? <span className="text-gray-400">None</span> : cos.map(co => (
                          <div key={co.id}>{co.creditorName}{co.balance > 0 ? ` (${formatBalance(co.balance)})` : ''}</div>
                        ))}
                      </td>
                    )
                  })}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-1 font-medium">Settled Accounts</td>
                  {reports.map(r => {
                    const settled = r.accounts.filter(a => (a.remarks || '').toLowerCase().includes('less than full') || (a.remarks || '').toLowerCase().includes('settled'))
                    return (
                      <td key={r.bureau} className="text-center py-2 px-1">
                        {settled.length === 0 ? <span className="text-gray-400">-</span> : settled.map(s => s.creditorName).join(', ')}
                      </td>
                    )
                  })}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-1 font-medium">Late Payments</td>
                  {reports.map(r => {
                    const lates = r.accounts.filter(a => a.isLate && !a.isChargeOff && !a.isCollection)
                    return (
                      <td key={r.bureau} className="text-center py-2 px-1">
                        {lates.length === 0 ? <span className="text-gray-400">-</span> : lates.map(l => l.creditorName).join(', ')}
                      </td>
                    )
                  })}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-1 font-medium">Hard Inquiries</td>
                  {reports.map(r => <td key={r.bureau} className="text-center py-2 px-1 font-bold">{r.summary.hardInquiries}</td>)}
                </tr>
                <tr>
                  <td className="py-2 px-1 font-medium">Total Debt (approx)</td>
                  {reports.map(r => <td key={r.bureau} className="text-center py-2 px-1 font-bold">~{formatBalance(Math.round(r.summary.totalBalance / 1000) * 1000)}</td>)}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Key Findings */}
          <div className="mt-5 p-4 bg-[#fef7e0] rounded-lg text-sm">
            <strong className="text-[#b06000]">Key Findings:</strong>
            <ul className="mt-1.5 text-gray-600 list-disc pl-5 space-y-0.5 text-sm">
              {(() => {
                const findings: React.ReactNode[] = []
                const allReports = reports
                const coNames = [...new Set(allReports.flatMap(r => r.accounts.filter(a => a.isChargeOff).map(a => a.creditorName)))]
                for (const name of coNames) {
                  const on = allReports.filter(r => r.accounts.some(a => a.isChargeOff && a.creditorName === name)).map(r => r.bureau)
                  if (on.length >= 2) {
                    const bal = allReports.flatMap(r => r.accounts.filter(a => a.isChargeOff && a.creditorName === name)).find(a => a.balance > 0)
                    findings.push(<span key={name}>{name} charge-off{bal ? ` (${formatBalance(bal.balance)})` : ''} appears on {on.join(' and ')}</span>)
                  }
                }
                const maxInq = allReports.reduce((max, r) => r.summary.hardInquiries > max ? r.summary.hardInquiries : max, 0)
                const maxInqBureau = allReports.find(r => r.summary.hardInquiries === maxInq)
                if (maxInqBureau) findings.push(<span key="maxinq">{maxInqBureau.bureau} has the most inquiries ({maxInq})</span>)
                const minInq = allReports.reduce((min, r) => r.summary.hardInquiries < min ? r.summary.hardInquiries : min, Infinity)
                const minInqBureau = allReports.find(r => r.summary.hardInquiries === minInq)
                if (minInqBureau) findings.push(<span key="mininq">{minInqBureau.bureau} shows only {minInq} inquiry, significantly fewer than the others</span>)
                const maxUtil = allReports.reduce((max, r) => r.summary.creditUtilization > max ? r.summary.creditUtilization : max, 0)
                if (maxUtil > 90) findings.push(<span key="util">Multiple accounts maxed out at high utilization across all bureaus</span>)
                const mortgage = allReports.flatMap(r => r.accounts).find(a => a.accountType === 'Mortgage' && a.balance > 0)
                if (mortgage) findings.push(<span key="mtg">Mortgage with {mortgage.creditorName} ({formatBalance(mortgage.balance)}) is the largest debt</span>)
                const studentLoan = allReports.flatMap(r => r.accounts).find(a => a.accountType === 'Student Loan' && a.balance > 0)
                if (studentLoan) findings.push(<span key="stu">{studentLoan.creditorName} is the second largest debt</span>)
                return findings.map((f, i) => <li key={i}>{f}</li>)
              })()}
            </ul>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-gray-500">
        Report generated from {reports.map((r, i) => r.personalInfo.reportDate ? `${r.bureau} (${r.personalInfo.reportDate})` : r.bureau).join(', ')} data.
      </p>
    </div>
  )
}
