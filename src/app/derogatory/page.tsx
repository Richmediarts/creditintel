'use client'

import React from 'react'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCredit } from '@/lib/store/creditStore'

export default function DerogatoryPage() {
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

  const derogatoryAccounts = creditData.disputeItems

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Derogatory Accounts</h1>
        <Badge variant="danger">{derogatoryAccounts.length} items</Badge>
      </div>

      {derogatoryAccounts.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-green-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No derogatory accounts found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {derogatoryAccounts.map((item, i) => (
            <Card key={i} className="border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">{item.creditorName}</h3>
                      <Badge>{item.bureau}</Badge>
                    </div>
                    <div className="flex gap-1 flex-wrap mt-2">
                      {item.inaccuracies.map((inacc, j) => (
                        <Badge key={j} variant="warning">{inacc.replace(/_/g, ' ')}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      +{item.estimatedScoreGain} pts est.
                    </p>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Recommended: {item.recommendedAction}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
