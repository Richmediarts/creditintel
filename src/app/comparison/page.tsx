'use client'

import React from 'react'
import { ArrowLeft, GitCompare } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCredit } from '@/lib/store/creditStore'

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

  const { mergedAccounts } = creditData
  const accountsWithDiscrepancies = mergedAccounts.filter(ma => ma.discrepancies.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Three-Bureau Comparison</h1>
      </div>

      {creditData.reports.length < 2 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <GitCompare className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Upload at least 2 bureau reports to see comparisons</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <CardTitle>Accounts Reporting Differently</CardTitle>
                <Badge variant={accountsWithDiscrepancies.length > 0 ? 'danger' : 'success'}>
                  {accountsWithDiscrepancies.length} discrepancies
                </Badge>
              </div>
              {accountsWithDiscrepancies.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">All accounts are reporting consistently across bureaus</p>
              ) : (
                <div className="space-y-3">
                  {accountsWithDiscrepancies.map(ma => (
                    <Card key={ma.id} className="border-l-4 border-l-yellow-500">
                      <CardContent className="p-3">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">{ma.creditorName}</h4>
                        {ma.discrepancies.map((disc, i) => (
                          <div key={i} className="text-sm mb-1">
                            <span className="text-gray-500 dark:text-gray-400">{disc.field}: </span>
                            {disc.values.map((v, j) => (
                              <span key={j} className={j > 0 ? 'text-red-500' : 'text-green-500'}>
                                {v.bureau}: {v.value}{j < disc.values.length - 1 ? ' vs ' : ''}
                              </span>
                            ))}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <CardTitle className="mb-4">All Merged Accounts</CardTitle>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Creditor</th>
                      <th className="text-center py-2 px-2 text-blue-600 font-medium">EXP</th>
                      <th className="text-center py-2 px-2 text-emerald-600 font-medium">EQ</th>
                      <th className="text-center py-2 px-2 text-purple-600 font-medium">TU</th>
                      <th className="text-center py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Discrepancies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedAccounts.map(ma => {
                      const getStatus = (bureau: string) => {
                        const acc = ma.accounts[bureau as keyof typeof ma.accounts]
                        if (!acc) return <span className="text-gray-300 dark:text-gray-600">-</span>
                        return (
                          <Badge variant={acc.isDerogatory ? 'danger' : acc.isOpen ? 'success' : 'default'}>
                            {acc.status}
                          </Badge>
                        )
                      }
                      return (
                        <tr key={ma.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">{ma.creditorName}</td>
                          <td className="text-center py-2 px-2">{getStatus('Experian')}</td>
                          <td className="text-center py-2 px-2">{getStatus('Equifax')}</td>
                          <td className="text-center py-2 px-2">{getStatus('TransUnion')}</td>
                          <td className="text-center py-2 px-2">
                            {ma.discrepancies.length > 0 ? (
                              <Badge variant="danger">{ma.discrepancies.length}</Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
