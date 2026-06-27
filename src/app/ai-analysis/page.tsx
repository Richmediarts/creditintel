'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, Brain, TrendingUp, AlertTriangle, CheckCircle, Clock, CreditCard, PieChart, Shield, Target, Lightbulb } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { useCredit } from '@/lib/store/creditStore'
import type { Bureau, FicoScores, BureauReport } from '@/types'
import { useRouter } from 'next/navigation'

const BUREAUS: Bureau[] = ['Experian', 'Equifax', 'TransUnion']

const BUREAU_COLORS: Record<Bureau, string> = {
  Experian: 'from-blue-500 to-blue-600',
  Equifax: 'from-emerald-500 to-emerald-600',
  TransUnion: 'from-purple-500 to-purple-600',
}

const BUREAU_BG: Record<Bureau, string> = {
  Experian: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
  Equifax: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  TransUnion: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',
}

const BUREAU_ICON_BG: Record<Bureau, string> = {
  Experian: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
  Equifax: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
  TransUnion: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
}

function scoreLabel(score: number): string {
  if (score < 580) return 'Poor'
  if (score < 670) return 'Fair'
  if (score < 740) return 'Good'
  if (score < 800) return 'Very Good'
  return 'Excellent'
}

function scoreBandColor(score: number): string {
  if (score < 580) return 'bg-red-500'
  if (score < 670) return 'bg-orange-500'
  if (score < 740) return 'bg-yellow-500'
  if (score < 800) return 'bg-green-500'
  return 'bg-emerald-600'
}

function scoreBandTextColor(score: number): string {
  if (score < 580) return 'text-red-500'
  if (score < 670) return 'text-orange-500'
  if (score < 740) return 'text-yellow-600 dark:text-yellow-400'
  if (score < 800) return 'text-green-500'
  return 'text-emerald-600'
}

type FactorGrade = { grade: string; color: string; textColor: string; label: string; desc: string }

function gradePaymentHistory(totalAccounts: number, lateAccounts: number, derogatoryAccounts: number): FactorGrade {
  const totalDerog = lateAccounts + derogatoryAccounts
  const ratio = totalAccounts > 0 ? totalDerog / totalAccounts : 0
  if (ratio === 0) return { grade: 'A', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', label: 'Payment History', desc: '100% on-time payment history' }
  if (ratio < 0.05) return { grade: 'B', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', label: 'Payment History', desc: `${Math.round((1 - ratio) * 100)}% on-time payments` }
  if (ratio < 0.15) return { grade: 'C', color: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400', label: 'Payment History', desc: `${Math.round((1 - ratio) * 100)}% on-time payments` }
  if (ratio < 0.3) return { grade: 'D', color: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400', label: 'Payment History', desc: `${Math.round((1 - ratio) * 100)}% on-time payments` }
  return { grade: 'F', color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', label: 'Payment History', desc: `${Math.round((1 - ratio) * 100)}% on-time payments — significant derogatory marks` }
}

function gradeUtilization(utilization: number): FactorGrade {
  if (utilization < 10) return { grade: 'A', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', label: 'Credit Utilization', desc: `Excellent ${utilization.toFixed(1)}% credit utilization` }
  if (utilization < 30) return { grade: 'B', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', label: 'Credit Utilization', desc: `Good ${utilization.toFixed(1)}% — under 30% threshold` }
  if (utilization < 50) return { grade: 'C', color: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400', label: 'Credit Utilization', desc: `Fair ${utilization.toFixed(1)}% — paying down balances would help` }
  if (utilization < 75) return { grade: 'D', color: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400', label: 'Credit Utilization', desc: `High ${utilization.toFixed(1)}% — this is a major scoring factor` }
  return { grade: 'F', color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', label: 'Credit Utilization', desc: `Very high ${utilization.toFixed(1)}% — maxing out cards hurts your score` }
}

function gradeCreditAge(reports: BureauReport[]): FactorGrade {
  const ages = reports.map(r => r.summary.averageAccountAge).filter((a): a is number => a !== undefined)
  if (ages.length === 0) return { grade: 'N', color: 'bg-gray-400', textColor: 'text-gray-500', label: 'Credit History', desc: 'Insufficient data to determine credit age' }
  const avgAge = ages.reduce((a, b) => a + b, 0) / ages.length
  const years = avgAge / 12
  if (years >= 10) return { grade: 'A', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', label: 'Credit History', desc: `Excellent average account age of ${years.toFixed(1)} years` }
  if (years >= 7) return { grade: 'B', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', label: 'Credit History', desc: `Good average account age of ${years.toFixed(1)} years` }
  if (years >= 4) return { grade: 'C', color: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400', label: 'Credit History', desc: `Average account age of ${years.toFixed(1)} years` }
  if (years >= 2) return { grade: 'D', color: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400', label: 'Credit History', desc: `Young credit history at ${years.toFixed(1)} years — let accounts age` }
  return { grade: 'F', color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', label: 'Credit History', desc: `Very short credit history at ${years.toFixed(1)} years` }
}

function gradeAccountMix(reports: BureauReport[]): FactorGrade & { types: number } {
  const allTypes = new Set<string>()
  for (const r of reports) {
    for (const a of r.accounts) {
      allTypes.add(a.accountType)
    }
  }
  const count = allTypes.size
  if (count >= 5) return { grade: 'A', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', label: 'Account Mix', desc: `Excellent mix with ${count} account types`, types: count }
  if (count >= 4) return { grade: 'B', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', label: 'Account Mix', desc: `Good diversity with ${count} account types`, types: count }
  if (count >= 3) return { grade: 'C', color: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400', label: 'Account Mix', desc: `Fair mix with ${count} account types`, types: count }
  if (count >= 2) return { grade: 'D', color: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400', label: 'Account Mix', desc: `Limited to ${count} account types — adding variety could help`, types: count }
  return { grade: 'F', color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', label: 'Account Mix', desc: `Only ${count} account type — lenders want to see variety`, types: count }
}

function gradeHardInquiries(totalHardInquiries: number): FactorGrade {
  if (totalHardInquiries === 0) return { grade: 'A', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', label: 'Hard Inquiries', desc: 'No hard inquiries — excellent' }
  if (totalHardInquiries <= 2) return { grade: 'B', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', label: 'Hard Inquiries', desc: `${totalHardInquiries} hard ${totalHardInquiries === 1 ? 'inquiry' : 'inquiries'} — minimal impact` }
  if (totalHardInquiries <= 5) return { grade: 'C', color: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400', label: 'Hard Inquiries', desc: `${totalHardInquiries} hard inquiries — moderate impact` }
  if (totalHardInquiries <= 10) return { grade: 'D', color: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400', label: 'Hard Inquiries', desc: `${totalHardInquiries} hard inquiries — each one hurts your score` }
  return { grade: 'F', color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', label: 'Hard Inquiries', desc: `${totalHardInquiries} hard inquiries — multiple inquiries signal risk` }
}

function gradeDerogatory(totalCollections: number, totalChargeOffs: number, totalBankruptcies: number): FactorGrade {
  const total = totalCollections + totalChargeOffs + totalBankruptcies
  if (total === 0) return { grade: 'A', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', label: 'Collections & Public Records', desc: 'No negative items' }
  if (total <= 2) return { grade: 'B', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', label: 'Collections & Public Records', desc: `${total} derogatory item${total > 1 ? 's' : ''}` }
  if (total <= 5) return { grade: 'C', color: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400', label: 'Collections & Public Records', desc: `${total} derogatory items — needs attention` }
  if (total <= 10) return { grade: 'D', color: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400', label: 'Collections & Public Records', desc: `${total} derogatory items — significant negative impact` }
  return { grade: 'F', color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', label: 'Collections & Public Records', desc: `${total} derogatory items — severely impacting your score` }
}

function FactorGradeCard({ factor, importance }: { factor: FactorGrade; importance: string }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className={`w-12 h-12 rounded-full ${factor.color} text-white flex items-center justify-center text-lg font-bold shrink-0`}>
        {factor.grade}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-gray-900 dark:text-white text-sm">{factor.label}</span>
          <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{importance}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{factor.desc}</p>
      </div>
    </div>
  )
}

export default function CreditAnalysisPage() {
  const { user } = useAuth()
  const { state } = useCredit()
  const { creditData } = state
  const [scores, setScores] = useState<FicoScores>({})
  const [scoresLoading, setScoresLoading] = useState(true)

  useEffect(() => {
    fetch('/api/fico-scores').then(res => res.ok && res.json()).then(data => {
      if (data?.scores) setScores(data.scores)
    }).finally(() => setScoresLoading(false))
  }, [])

  if (!creditData) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <Brain className="w-14 h-14 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-lg font-medium mb-1">No credit data available</p>
        <p className="text-sm">Upload reports first to see your credit analysis.</p>
        <Link href="/upload" className="text-blue-600 hover:underline text-sm mt-3 inline-block">Go to Upload Center</Link>
      </div>
    )
  }

  const { reports, globalSummary, aiFindings } = creditData

  const factors: FactorGrade[] = [
    gradePaymentHistory(globalSummary.totalAccounts, globalSummary.totalLateAccounts, globalSummary.totalDerogatory),
    gradeUtilization(globalSummary.totalCreditUtilization),
    gradeCreditAge(reports),
    gradeAccountMix(reports) as FactorGrade,
    gradeHardInquiries(globalSummary.totalHardInquiries),
    gradeDerogatory(globalSummary.totalCollections, globalSummary.totalChargeOffs, globalSummary.totalBankruptcies),
  ]

  const highSeverityFindings = aiFindings.filter(f => f.severity === 'high')
  const mediumSeverityFindings = aiFindings.filter(f => f.severity === 'medium')

  const reportDate = reports.length > 0
    ? reports.map(r => r.personalInfo.reportDate).filter(Boolean).sort().reverse()[0]
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Credit Analysis</h1>
          <p className="text-sm text-gray-500">
            {user?.name || 'Consumer'}
            {reportDate ? ` \u2022 Report as of ${new Date(reportDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : ''}
          </p>
        </div>
      </div>

      {/* FICO Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BUREAUS.map(bureau => {
          const score = scores[bureau]?.score
          const label = score ? scoreLabel(score) : 'N/A'
          const bandColor = score ? scoreBandColor(score) : 'bg-gray-300 dark:bg-gray-600'
          const textColor = score ? scoreBandTextColor(score) : 'text-gray-400 dark:text-gray-500'
          const pct = score ? ((score - 300) / 550) * 100 : 0

          return (
            <div key={bureau} className={`rounded-xl border p-5 ${BUREAU_BG[bureau]}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{bureau}</span>
                <div className={`w-8 h-8 rounded-full ${BUREAU_ICON_BG[bureau]} flex items-center justify-center`}>
                  <Shield className="w-4 h-4" />
                </div>
              </div>
              {score ? (
                <>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">{score}</span>
                    <span className={`text-xs font-medium ${textColor}`}>{label}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-3">
                    <div className={`h-full rounded-full ${bandColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    <span>300</span>
                    <span>850</span>
                  </div>
                  {scores[bureau]?.dateUpdated && (
                    <p className="text-[10px] text-gray-400 mt-2">Updated {new Date(scores[bureau]!.dateUpdated!).toLocaleDateString()}</p>
                  )}
                </>
              ) : scoresLoading ? (
                <div className="h-16 flex items-center">
                  <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">No score data</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Factor Grades */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-gray-400" />
            <CardTitle>Know Where to Focus</CardTitle>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 -mt-2">
            Letter grades for each credit factor show where you're doing well and where to focus for bigger score gains.
          </p>
          <div className="space-y-3">
            {factors.map((f, i) => (
              <FactorGradeCard key={i} factor={f} importance={
                f.label === 'Payment History' || f.label === 'Credit Utilization' ? 'High Importance' :
                f.label === 'Hard Inquiries' || f.label === 'Collections & Public Records' ? 'Moderate Importance' : 'Low Importance'
              } />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Findings & Action Items */}
      {aiFindings.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <CardTitle>How Can I Improve My Credit Score</CardTitle>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 -mt-2">
              Personalized recommendations based on your credit report data.
            </p>
            <div className="space-y-3">
              {[...highSeverityFindings, ...mediumSeverityFindings, ...aiFindings.filter(f => f.severity === 'low')].map((finding, i) => {
                const isHigh = finding.severity === 'high'
                const isMed = finding.severity === 'medium'
                return (
                  <div key={i} className={`p-4 rounded-lg border ${isHigh ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' : isMed ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${isHigh ? 'text-red-500' : isMed ? 'text-amber-500' : 'text-gray-400'}`}>
                        {isHigh ? <AlertTriangle className="w-5 h-5" /> : isMed ? <Clock className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={isHigh ? 'danger' : isMed ? 'warning' : 'info'}>
                            {isHigh ? 'HIGH PRIORITY' : isMed ? 'MEDIUM' : 'OPPORTUNITY'}
                          </Badge>
                          {finding.estimatedScoreImpact && (
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              +{finding.estimatedScoreImpact} pts potential
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{finding.description}</p>
                        {finding.bureaus && finding.bureaus.length > 0 && (
                          <div className="flex gap-1.5 mt-2">
                            {finding.bureaus.map(b => (
                              <span key={b} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">{b}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-gray-400" />
            <CardTitle>Credit Snapshot</CardTitle>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Accounts</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{globalSummary.totalAccounts}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Open Accounts</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{globalSummary.totalOpen}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Credit Utilization</p>
              <p className={`text-xl font-bold ${globalSummary.totalCreditUtilization > 30 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {globalSummary.totalCreditUtilization.toFixed(1)}%
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Balance</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${globalSummary.totalBalance.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Derogatory Items</p>
              <p className={`text-xl font-bold ${globalSummary.totalDerogatory > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{globalSummary.totalDerogatory}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Hard Inquiries</p>
              <p className={`text-xl font-bold ${globalSummary.totalHardInquiries > 5 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{globalSummary.totalHardInquiries}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Collections</p>
              <p className={`text-xl font-bold ${globalSummary.totalCollections > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{globalSummary.totalCollections}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Charge-Offs</p>
              <p className={`text-xl font-bold ${globalSummary.totalChargeOffs > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{globalSummary.totalChargeOffs}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportDate && (
        <p className="text-center text-[10px] text-gray-400 dark:text-gray-600">
          Analysis based on {reports.length} bureau report{reports.length > 1 ? 's' : ''} as of {new Date(reportDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
        </p>
      )}
    </div>
  )
}
