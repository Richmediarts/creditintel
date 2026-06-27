'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, TrendingUp, CreditCard, AlertTriangle, Shield, XCircle, Search, RotateCcw, Clock, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { useCredit } from '@/lib/store/creditStore'
import type { Bureau, FicoScores, BureauReport } from '@/types'

const BUREAUS: Bureau[] = ['Experian', 'Equifax', 'TransUnion']

const BUREAU_STYLES: Record<Bureau, { bg: string; lightBg: string }> = {
  Experian: { bg: 'bg-blue-500', lightBg: 'bg-blue-50 dark:bg-blue-950/30' },
  Equifax: { bg: 'bg-emerald-500', lightBg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  TransUnion: { bg: 'bg-purple-500', lightBg: 'bg-purple-50 dark:bg-purple-950/30' },
}

function scoreLabel(score: number): string {
  if (score < 580) return 'Poor'
  if (score < 670) return 'Fair'
  if (score < 740) return 'Good'
  if (score < 800) return 'Very Good'
  return 'Excellent'
}

function scoreColor(score: number): string {
  if (score < 580) return 'text-red-500'
  if (score < 670) return 'text-orange-500'
  if (score < 740) return 'text-yellow-600 dark:text-yellow-400'
  if (score < 800) return 'text-green-500'
  return 'text-emerald-500'
}

function scoreBarColor(score: number): string {
  if (score < 580) return 'bg-red-500'
  if (score < 670) return 'bg-orange-500'
  if (score < 740) return 'bg-yellow-500'
  if (score < 800) return 'bg-green-500'
  return 'bg-emerald-600'
}

interface SimAction {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  timeline: string
}

const ACTIONS: SimAction[] = [
  { id: 'pay_down', label: 'Pay Down Cards', description: 'Reduce utilization under 10%', icon: <TrendingUp className="w-5 h-5" />, timeline: '30-60 days' },
  { id: 'remove_late', label: 'Remove Late Payments', description: 'Dispute late payment marks', icon: <AlertTriangle className="w-5 h-5" />, timeline: '60-90 days' },
  { id: 'remove_collection', label: 'Remove Collections', description: 'Pay or dispute collection accounts', icon: <XCircle className="w-5 h-5" />, timeline: '30-60 days' },
  { id: 'remove_chargeoff', label: 'Remove Charge-Offs', description: 'Settle or dispute charge-offs', icon: <Shield className="w-5 h-5" />, timeline: '60-90 days' },
  { id: 'remove_inquiries', label: 'Remove Inquiries', description: 'Remove excess hard inquiries', icon: <Search className="w-5 h-5" />, timeline: 'Immediate' },
  { id: 'open_card', label: 'Open New Card', description: 'Add a new revolving account', icon: <CreditCard className="w-5 h-5" />, timeline: '6-12 months' },
]

interface BureauImpact {
  bureau: Bureau
  currentScore: number
  newScore: number
  impact: number
  affected: number
}

function simulateAction(actionId: string, reports: BureauReport[], baseScores: FicoScores): BureauImpact[] {
  return BUREAUS.map(bureau => {
    const currentScore = baseScores[bureau]?.score || 650
    const report = reports.find(r => r.bureau === bureau)

    if (!report) return { bureau, currentScore, newScore: currentScore, impact: 0, affected: 0 }

    const s = report.summary
    let impact = 0
    let affected = 0

    switch (actionId) {
      case 'pay_down': {
        if (s.creditUtilization > 10) {
          const reduction = s.creditUtilization - 10
          impact = Math.min(Math.floor(reduction / 5) * 8, 45)
          affected = report.accounts.filter(a => a.creditLimit && (a.balance / a.creditLimit) > 0.3).length
        }
        break
      }
      case 'remove_late': {
        if (s.lateAccounts > 0) {
          impact = Math.min(s.lateAccounts * 12, 50)
          affected = s.lateAccounts
        }
        break
      }
      case 'remove_collection': {
        if (s.collections > 0) {
          impact = Math.min(s.collections * 20, 40)
          affected = s.collections
        }
        break
      }
      case 'remove_chargeoff': {
        if (s.chargeOffs > 0) {
          impact = Math.min(s.chargeOffs * 15, 45)
          affected = s.chargeOffs
        }
        break
      }
      case 'remove_inquiries': {
        if (s.hardInquiries > 3) {
          const excess = s.hardInquiries - 3
          impact = Math.min(excess * 5, 20)
          affected = excess
        }
        break
      }
      case 'open_card': {
        const mixBonus = s.totalAccounts > 0 && report.accounts.every(a => a.accountType === 'Revolving') ? 10 : 0
        impact = -5 + mixBonus
        affected = 1
        break
      }
    }

    const newScore = Math.max(300, Math.min(850, currentScore + impact))
    return { bureau, currentScore, newScore, impact, affected }
  })
}

export default function ScoreSimulatorPage() {
  const { user } = useAuth()
  const { state } = useCredit()
  const { creditData } = state
  const [scores, setScores] = useState<FicoScores>({})
  const [scoresLoading, setScoresLoading] = useState(true)
  const [selectedAction, setSelectedAction] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/fico-scores').then(res => res.ok && res.json()).then(data => {
      if (data?.scores) setScores(data.scores)
    }).finally(() => setScoresLoading(false))
  }, [])

  if (!creditData) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium mb-1">No credit data available</p>
        <p className="text-sm">Upload reports first to use the simulator.</p>
        <Link href="/upload" className="text-blue-600 hover:underline text-sm mt-3 inline-block">Go to Upload Center</Link>
      </div>
    )
  }

  const { reports } = creditData
  const results = selectedAction ? simulateAction(selectedAction, reports, scores) : null
  const hasScores = Object.values(scores).some(s => s?.score != null)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Score Simulator</h1>
          <p className="text-sm text-gray-500">{user?.name || 'Consumer'} &bull; {reports.length} bureau{reports.length > 1 ? 's' : ''} reporting</p>
        </div>
      </div>

      {/* Current Scores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BUREAUS.map(bureau => {
          const score = scores[bureau]?.score
          return (
            <div key={bureau} className={`rounded-xl border p-5 ${BUREAU_STYLES[bureau].lightBg} border-gray-200 dark:border-gray-700`}>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{bureau}</p>
              {scoresLoading ? (
                <div className="h-14 flex items-center">
                  <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : score ? (
                <>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{score}</p>
                  <p className={`text-xs font-medium mt-0.5 ${scoreColor(score)}`}>{scoreLabel(score)}</p>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-3">
                    <div className={`h-full rounded-full ${scoreBarColor(score)}`} style={{ width: `${((score - 300) / 550) * 100}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold text-gray-300 dark:text-gray-600">--</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    <Link href="/fico-scores" className="text-blue-500 hover:underline">Enter a score</Link>
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Move Simulate an Action below scores, but only show if there are scores */}
      {hasScores && (
        <Card>
          <CardContent className="p-5">
            <CardTitle className="mb-4">Simulate an Action</CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 -mt-2">Select an action to see how your credit score would change across each bureau.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ACTIONS.map(action => {
                const isSelected = selectedAction === action.id
                return (
                  <button
                    key={action.id}
                    onClick={() => setSelectedAction(isSelected ? null : action.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${isSelected ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'}`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                      {action.icon}
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{action.label}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{action.description}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{action.timeline}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!hasScores && !scoresLoading && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">No FICO scores entered yet.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              <Link href="/fico-scores" className="text-blue-500 hover:underline">Go to FICO Scores page</Link> to add your scores, then return here to simulate improvements.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <CardTitle>Projected Scores</CardTitle>
              </div>
              <Button onClick={() => setSelectedAction(null)} variant="ghost" size="sm" className="text-xs">
                <RotateCcw className="w-3 h-3 mr-1" /> Reset
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 -mt-2">
              After: {ACTIONS.find(a => a.id === selectedAction)?.label.toLowerCase()} &bull; Timeline: {ACTIONS.find(a => a.id === selectedAction)?.timeline}
            </p>
            <div className="space-y-4">
              {results.map((r, i) => (
                <div key={i} className={`p-4 rounded-xl border ${BUREAU_STYLES[r.bureau].lightBg} border-gray-200 dark:border-gray-700`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{r.bureau}</span>
                    <Badge variant={r.impact > 0 ? 'success' : r.impact < 0 ? 'danger' : 'info'}>
                      {r.impact > 0 ? '+' : ''}{r.impact} pts
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Current</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{r.currentScore}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Projected</p>
                      <p className={`text-lg font-bold ${r.impact > 0 ? 'text-emerald-600 dark:text-emerald-400' : r.impact < 0 ? 'text-red-500' : ''}`}>{r.newScore}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <span className="w-16 shrink-0">Current ({r.currentScore})</span>
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${scoreBarColor(r.currentScore)}`} style={{ width: `${((r.currentScore - 300) / 550) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <span className="w-16 shrink-0">Projected ({r.newScore})</span>
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${scoreBarColor(r.newScore)}`} style={{ width: `${((r.newScore - 300) / 550) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  {r.affected > 0 && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">{r.affected} item{r.affected > 1 ? 's' : ''} affected on this bureau</p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Estimated impact only</p>
              <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70 mt-0.5">
                Score changes are estimates based on your credit report data. Actual results vary by lender scoring models.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score Range */}
      <Card>
        <CardContent className="p-4">
          <CardTitle className="mb-3 text-sm text-gray-900 dark:text-white">Score Range Guide</CardTitle>
          <div className="flex items-center gap-1 h-8">
            <div className="bg-red-500 h-full flex-1 rounded-l-lg flex items-center justify-center text-[10px] text-white font-medium">300-579</div>
            <div className="bg-orange-500 h-full flex-[1.5] flex items-center justify-center text-[10px] text-white font-medium">580-669</div>
            <div className="bg-yellow-500 h-full flex-[1.5] flex items-center justify-center text-[10px] text-white font-medium">670-739</div>
            <div className="bg-green-500 h-full flex-[1.5] flex items-center justify-center text-[10px] text-white font-medium">740-799</div>
            <div className="bg-emerald-600 h-full flex-1 rounded-r-lg flex items-center justify-center text-[10px] text-white font-medium">800-850</div>
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            <span>Poor</span><span>Fair</span><span>Good</span><span>Very Good</span><span>Excellent</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
