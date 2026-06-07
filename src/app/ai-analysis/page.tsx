'use client'

import React from 'react'
import { ArrowLeft, Brain } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCredit } from '@/lib/store/creditStore'

export default function AIAnalysisPage() {
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

  const { aiFindings } = creditData

  const groupedFindings = {
    high: aiFindings.filter(f => f.severity === 'high'),
    medium: aiFindings.filter(f => f.severity === 'medium'),
    low: aiFindings.filter(f => f.severity === 'low'),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI Credit Analysis</h1>
      </div>

      {aiFindings.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Brain className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No AI findings generated. Upload more reports for comprehensive analysis.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <CardTitle>High Severity Issues</CardTitle>
                <Badge variant="danger">{groupedFindings.high.length}</Badge>
              </div>
              <div className="space-y-2">
                {groupedFindings.high.map((f, i) => (
                  <div key={i} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Badge variant="danger">HIGH</Badge>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{f.description}</p>
                    </div>
                    {f.estimatedScoreImpact && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-14">
                        Score impact: {f.estimatedScoreImpact > 0 ? '+' : ''}{f.estimatedScoreImpact} points
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <CardTitle>Medium Severity Issues</CardTitle>
                <Badge variant="warning">{groupedFindings.medium.length}</Badge>
              </div>
              <div className="space-y-2">
                {groupedFindings.medium.map((f, i) => (
                  <div key={i} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Badge variant="warning">MED</Badge>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{f.description}</p>
                    </div>
                    {f.estimatedScoreImpact && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-14">
                        Score impact: {f.estimatedScoreImpact > 0 ? '+' : ''}{f.estimatedScoreImpact} points
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
