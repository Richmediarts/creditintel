'use client'

import React from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useCredit } from '@/lib/store/creditStore'
import { simulateScoreImprovements } from '@/lib/utils/scoreSimulator'

export default function ScoreSimulatorPage() {
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

  const simulation = simulateScoreImprovements(creditData.reports, creditData.mergedAccounts, creditData.globalSummary)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Score Improvement Simulator</h1>
      </div>

      {/* Current Score */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Estimated Score</p>
            <p className="text-5xl font-bold text-gray-900 dark:text-white">{simulation.currentEstimatedScore}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Based on your current credit profile</p>
          </div>
          <div className="mt-4">
            <Progress
              value={((simulation.currentEstimatedScore - 300) / (850 - 300)) * 100}
              variant={simulation.currentEstimatedScore < 580 ? 'danger' : simulation.currentEstimatedScore < 670 ? 'warning' : 'success'}
              className="h-3"
              showLabel
            />
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
              <span>300 (Poor)</span>
              <span>850 (Excellent)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenarios */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Improvement Scenarios</h2>
        {simulation.scenarios.map((scenario, i) => {
          const isMax = scenario.name.includes('Maximum')
          const maxScore = simulation.scenarios.filter(s => !s.name.includes('Maximum')).reduce((sum, s) => sum + s.impact, 0) + simulation.currentEstimatedScore
          const displayScore = isMax ? maxScore : scenario.newScore
          return (
            <Card key={i} className={`${isMax ? 'border-2 border-blue-500 dark:border-blue-400' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">{scenario.name}</h3>
                      {isMax && <Badge variant="info">Best Case</Badge>}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{scenario.description}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {scenario.itemsAffected > 0 && `${scenario.itemsAffected} item(s) affected`}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className={`text-2xl font-bold ${scenario.impact > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                      {displayScore}
                    </p>
                    <Badge variant="success" className="mt-1">
                      +{scenario.impact} pts
                    </Badge>
                  </div>
                </div>
                {!isMax && (
                  <div className="mt-3">
                    <Progress
                      value={((displayScore - simulation.currentEstimatedScore) / (maxScore - simulation.currentEstimatedScore)) * 100}
                      variant="success"
                      className="h-2"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Score Range Visualization */}
      <Card>
        <CardContent className="p-4">
          <CardTitle className="mb-3">Score Range</CardTitle>
          <div className="flex items-center gap-1 h-8">
            <div className="bg-red-500 h-full flex-1 rounded-l-lg flex items-center justify-center text-[10px] text-white font-medium">300-579</div>
            <div className="bg-orange-500 h-full flex-[1.5] flex items-center justify-center text-[10px] text-white font-medium">580-669</div>
            <div className="bg-yellow-500 h-full flex-[1.5] flex items-center justify-center text-[10px] text-white font-medium">670-739</div>
            <div className="bg-green-500 h-full flex-[1.5] flex items-center justify-center text-[10px] text-white font-medium">740-799</div>
            <div className="bg-emerald-600 h-full flex-1 rounded-r-lg flex items-center justify-center text-[10px] text-white font-medium">800-850</div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Poor</span>
            <span>Fair</span>
            <span>Good</span>
            <span>Very Good</span>
            <span>Excellent</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
