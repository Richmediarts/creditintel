'use client'

import React from 'react'
import { Upload } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCredit } from '@/lib/store/creditStore'
import { formatCurrency, formatPercentage } from '@/lib/utils/analysis'
import type { Bureau, BureauReport } from '@/types'
import { UploadZone } from '@/components/dashboard/UploadZone'

const bureauGradients: Record<Bureau, string> = {
  Experian: 'from-blue-500 to-blue-600',
  Equifax: 'from-emerald-500 to-emerald-600',
  TransUnion: 'from-purple-500 to-purple-600',
}

export function DashboardPage() {
  const { state } = useCredit()
  const { creditData } = state

  if (!creditData || state.reports.length === 0) {
    return <EmptyState />
  }

  const { globalSummary, reports, aiFindings, mergedAccounts } = creditData
  const highSeverityFindings = aiFindings.filter(f => f.severity === 'high')

  return (
    <div className="space-y-6">
      {/* Top Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <SummaryStat label="Total Accounts" value={globalSummary.totalAccounts} />
        <SummaryStat label="Open Accounts" value={globalSummary.totalOpen} />
        <SummaryStat label="Closed Accounts" value={globalSummary.totalClosed} />
        <SummaryStat label="Derogatory" value={globalSummary.totalDerogatory} variant="danger" />
        <SummaryStat label="Charge Offs" value={globalSummary.totalChargeOffs} variant="danger" />
        <SummaryStat label="Collections" value={globalSummary.totalCollections} variant="warning" />
        <SummaryStat label="Public Records" value={globalSummary.totalPublicRecords} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryStat label="Hard Inquiries" value={globalSummary.totalHardInquiries} variant={globalSummary.totalHardInquiries > 10 ? 'warning' : 'default'} />
        <SummaryStat label="Soft Inquiries" value={globalSummary.totalSoftInquiries} />
        <SummaryStat label="Late Accounts" value={globalSummary.totalLateAccounts} variant="warning" />
        <SummaryStat label="Utilization" value={formatPercentage(globalSummary.totalCreditUtilization)} />
      </div>

      {/* Bureau Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reports.map(report => (
          <BureauCard key={report.bureau} report={report} gradient={bureauGradients[report.bureau]} />
        ))}
        {Array.from({ length: 3 - reports.length }).map((_, i) => (
          <MissingBureauCard key={i} />
        ))}
      </div>

      {/* Side-by-Side Comparison & AI Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Side-by-Side Comparison</h3>
              {mergedAccounts.filter(ma => ma.reportedOn.length > 1).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Upload multiple bureau reports to see comparisons</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Creditor</th>
                        <th className="text-center py-2 px-2 text-blue-600 font-medium">EXP</th>
                        <th className="text-center py-2 px-2 text-emerald-600 font-medium">EQ</th>
                        <th className="text-center py-2 px-2 text-purple-600 font-medium">TU</th>
                        <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mergedAccounts.filter(ma => ma.reportedOn.length > 1).slice(0, 10).map(ma => {
                        const getBalance = (bureau: Bureau) => {
                          const acc = ma.accounts[bureau]
                          return acc ? `$${acc.balance}` : '-'
                        }
                        return (
                          <tr key={ma.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">{ma.creditorName}</td>
                            <td className="text-center py-2 px-2 text-gray-700 dark:text-gray-300">
                              <span className={ma.accounts.Experian?.isDerogatory ? 'text-red-500 font-medium' : ''}>
                                {getBalance('Experian')}
                              </span>
                            </td>
                            <td className="text-center py-2 px-2 text-gray-700 dark:text-gray-300">
                              <span className={ma.accounts.Equifax?.isDerogatory ? 'text-red-500 font-medium' : ''}>
                                {getBalance('Equifax')}
                              </span>
                            </td>
                            <td className="text-center py-2 px-2 text-gray-700 dark:text-gray-300">
                              <span className={ma.accounts.TransUnion?.isDerogatory ? 'text-red-500 font-medium' : ''}>
                                {getBalance('TransUnion')}
                              </span>
                            </td>
                            <td className="text-right py-2 px-2">
                              <Badge variant={ma.bestStatus === 'Open' ? 'success' : ma.bestStatus === 'Closed' ? 'default' : 'danger'}>
                                {ma.bestStatus || '-'}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">AI Findings</h3>
              {aiFindings.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No AI findings generated yet</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {highSeverityFindings.slice(0, 5).map((finding, i) => (
                    <div key={i} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Badge variant="danger">HIGH</Badge>
                        <p className="text-xs text-gray-700 dark:text-gray-300">{finding.description}</p>
                      </div>
                      {finding.estimatedScoreImpact && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Est. score impact: {finding.estimatedScoreImpact > 0 ? '+' : ''}{finding.estimatedScoreImpact} pts
                        </p>
                      )}
                    </div>
                  ))}
                  {aiFindings.filter(f => f.severity === 'medium').slice(0, 3).map((finding, i) => (
                    <div key={i} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Badge variant="warning">MED</Badge>
                        <p className="text-xs text-gray-700 dark:text-gray-300">{finding.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dispute Center Preview */}
      {creditData.disputeItems.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Dispute Center</h3>
              <Badge variant="danger">{creditData.disputeItems.length} items</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Creditor</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Bureau</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Inaccuracies</th>
                    <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Est. Gain</th>
                  </tr>
                </thead>
                <tbody>
                  {creditData.disputeItems.slice(0, 8).map((item, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">{item.creditorName}</td>
                      <td className="py-2 px-2">
                        <Badge variant={item.bureau === 'Experian' ? 'info' : item.bureau === 'Equifax' ? 'success' : 'default'}>
                          {item.bureau}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1 flex-wrap">
                          {item.inaccuracies.map((inacc, j) => (
                            <Badge key={j} variant="warning" className="text-[10px]">{inacc.replace('_', ' ')}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="text-right py-2 px-2 text-green-600 font-medium">+{item.estimatedScoreGain} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryStat({ label, value, variant = 'default' }: { label: string; value: string | number; variant?: 'default' | 'danger' | 'warning' }) {
  const colorMap = {
    default: 'text-gray-900 dark:text-white',
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
  }
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
        <p className={`text-lg font-bold ${colorMap[variant]}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function BureauCard({ report, gradient }: { report: BureauReport; gradient: string }) {
  return (
    <Card>
      <div className={`h-2 rounded-t-xl bg-gradient-to-r ${gradient}`} />
      <CardContent className="p-4">
        <h3 className="font-bold text-gray-900 dark:text-white mb-3">{report.bureau}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Accounts</span>
            <span className="font-medium text-gray-900 dark:text-white">{report.summary.totalAccounts}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Derogatory</span>
            <span className={`font-medium ${report.summary.derogatoryAccounts > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
              {report.summary.derogatoryAccounts}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Hard Inquiries</span>
            <span className="font-medium text-gray-900 dark:text-white">{report.summary.hardInquiries}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Balance</span>
            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(report.summary.totalBalance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Utilization</span>
            <span className={`font-medium ${report.summary.creditUtilization > 50 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
              {formatPercentage(report.summary.creditUtilization)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MissingBureauCard() {
  return (
    <Card className="opacity-60">
      <div className="h-2 rounded-t-xl bg-gray-300 dark:bg-gray-600" />
      <CardContent className="p-4">
        <h3 className="font-bold text-gray-400 dark:text-gray-500 mb-3">Not Uploaded</h3>
        <div className="space-y-2 text-sm">
          {['Accounts', 'Derogatory', 'Hard Inquiries', 'Balance', 'Utilization'].map(label => (
            <div key={label} className="flex justify-between">
              <span className="text-gray-400 dark:text-gray-500">{label}</span>
              <span className="text-gray-300 dark:text-gray-600">-</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
        <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Credit Reports Uploaded</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-6">
        Upload your credit reports from Experian, Equifax, and TransUnion to get started.
        The dashboard will automatically analyze and compare all three bureaus.
      </p>
      <UploadZone />
    </div>
  )
}
