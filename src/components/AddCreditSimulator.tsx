'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Plus, CreditCard, Landmark, Car, Home, ChevronRight, Sparkles, Clock, AlertTriangle } from 'lucide-react'
import type { Bureau, FicoScores, BureauReport, Account } from '@/types'

const BUREAUS: Bureau[] = ['Experian', 'Equifax', 'TransUnion']

const BUREAU_STYLES: Record<Bureau, { lightBg: string }> = {
  Experian: { lightBg: 'bg-blue-50 dark:bg-blue-950/30' },
  Equifax: { lightBg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  TransUnion: { lightBg: 'bg-purple-50 dark:bg-purple-950/30' },
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

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  Revolving: 'Credit Cards',
  Installment: 'Personal Loans',
  Auto: 'Auto Loans',
  Mortgage: 'Mortgages',
}

interface LoanOption {
  id: 'card' | 'personal' | 'auto' | 'mortgage'
  label: string
  description: string
  icon: React.ReactNode
  accountType: Account['accountType']
  mixValue: number
  timeline: string
}

const LOAN_OPTIONS: LoanOption[] = [
  {
    id: 'card',
    label: 'Credit Card',
    description: 'Add revolving credit with a new limit',
    icon: <CreditCard className="w-5 h-5" />,
    accountType: 'Revolving',
    mixValue: 10,
    timeline: 'Shown within 30-45 days',
  },
  {
    id: 'personal',
    label: 'Personal Loan',
    description: 'Add an installment loan (credit builder)',
    icon: <Landmark className="w-5 h-5" />,
    accountType: 'Installment',
    mixValue: 15,
    timeline: 'Shown within 30-60 days',
  },
  {
    id: 'auto',
    label: 'Auto Loan',
    description: 'Add an installment auto loan',
    icon: <Car className="w-5 h-5" />,
    accountType: 'Auto',
    mixValue: 12,
    timeline: 'Shown within 30-60 days',
  },
  {
    id: 'mortgage',
    label: 'Mortgage',
    description: 'Add a mortgage installment loan',
    icon: <Home className="w-5 h-5" />,
    accountType: 'Mortgage',
    mixValue: 15,
    timeline: 'Shown after closing',
  },
]

interface Driver {
  label: string
  impact: number
}

interface BureauProjection {
  bureau: Bureau
  currentScore: number
  projected: number
  total: number
  drivers: Driver[]
  newUtil: number | null
  oldUtil: number | null
}

function utilImpact(fromUtil: number, toUtil: number): number {
  const target = Math.max(toUtil, 10)
  if (fromUtil <= 10) return 0
  const reduction = fromUtil - target
  if (reduction <= 0) return 0
  return Math.min(Math.floor(reduction / 5) * 8, 45)
}

function queryLoss(fromUtil: number, toUtil: number): number {
  if (toUtil <= fromUtil) return 0
  const increase = toUtil - fromUtil
  return Math.min(Math.floor(increase / 5) * 4, 20)
}

function agePenalty(avgAgeMonths?: number): number {
  if (avgAgeMonths == null) return -5
  if (avgAgeMonths < 12) return -10
  if (avgAgeMonths < 36) return -7
  if (avgAgeMonths < 72) return -5
  return -3
}

function simulateLoan(
  option: LoanOption,
  amount: number,
  startingBalance: number,
  report: BureauReport,
  currentScore: number
): BureauProjection {
  const drivers: Driver[] = []
  const s = report.summary
  const accountTypes = new Set(report.accounts.map(a => a.accountType))
  const hasThisType = accountTypes.has(option.accountType)

  // Hard inquiry
  drivers.push({ label: 'Hard inquiry', impact: -5 })

  // New account / average age
  const ageImpact = agePenalty(s.averageAccountAge)
  drivers.push({ label: 'Average account age', impact: ageImpact })

  // Utilization (revolving only)
  let newUtil: number | null = null
  let oldUtil: number | null = null
  if (option.id === 'card') {
    oldUtil = s.creditUtilization
    const totalLimit = s.totalCreditLimit || 0
    const totalBalance = s.totalBalance || 0
    const newLimit = totalLimit + amount
    const newBalance = totalBalance + startingBalance
    newUtil = newLimit > 0 ? (newBalance / newLimit) * 100 : 0
    const gain = utilImpact(oldUtil, newUtil)
    const loss = queryLoss(oldUtil, newUtil)
    const util = gain - loss
    drivers.push({
      label: `Utilization (${oldUtil.toFixed(0)}% → ${newUtil.toFixed(0)}%)`,
      impact: util,
    })
  }

  // Credit mix
  let mixImpact: number
  if (hasThisType) {
    mixImpact = accountTypes.size <= 1 ? 5 : 0
  } else {
    mixImpact = option.mixValue
  }
  drivers.push({
    label: `Credit mix (adds ${ACCOUNT_TYPE_LABELS[option.accountType] || option.accountType})`,
    impact: mixImpact,
  })

  // Amount owed pressure on large new debt
  let debtImpact = 0
  if (option.id !== 'card' && amount >= 15000) {
    debtImpact = -Math.min(Math.floor(amount / 25000), 8)
    drivers.push({ label: 'New debt balance', impact: debtImpact })
  }

  const total = drivers.reduce((sum, d) => sum + d.impact, 0)
  const projected = Math.max(300, Math.min(850, currentScore + total))

  return { bureau: report.bureau, currentScore, projected, total, drivers, newUtil, oldUtil }
}

function Field({ label, value, onChange, placeholder, hint }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-7 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {hint && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

export default function AddCreditSimulator({
  reports,
  scores,
  scoresLoading,
}: {
  reports: BureauReport[]
  scores: FicoScores
  scoresLoading: boolean
}) {
  const [optionId, setOptionId] = useState<LoanOption['id']>('card')
  const [amountStr, setAmountStr] = useState('')
  const [balanceStr, setBalanceStr] = useState('')

  const option = LOAN_OPTIONS.find(o => o.id === optionId) || LOAN_OPTIONS[0]
  const amount = parseFloat(amountStr) || 0
  const startingBalance = option.id === 'card' ? parseFloat(balanceStr) || 0 : 0

  const projections: BureauProjection[] | null =
    amount > 0
      ? BUREAUS.map(bureau => {
          const report = reports.find(r => r.bureau === bureau)
          const currentScore = scores[bureau]?.score ?? null
          if (!report || currentScore == null) return null
          return simulateLoan(option, amount, startingBalance, report, currentScore)
        }).filter((p): p is BureauProjection => p !== null)
      : null

  const reset = () => {
    setAmountStr('')
    setBalanceStr('')
  }

  return (
    <Card className="border-t-4 border-t-blue-500">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" />
            <CardTitle>Add Credit or a Loan</CardTitle>
          </div>
          <button
            onClick={reset}
            title="Reset"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Clock className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 -mt-0.5">
          See what opening a new credit line or loan would do to your FICO scores. Adding new credit lowers your average
          account age and adds a hard inquiry (small negative), but can help through better utilization (cards) and a
          healthier credit mix (loans).
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">What are you adding?</label>
              <div className="grid grid-cols-2 gap-2">
                {LOAN_OPTIONS.map(o => {
                  const isSelected = o.id === optionId
                  return (
                    <button
                      key={o.id}
                      onClick={() => setOptionId(o.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${isSelected ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                        {o.icon}
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{o.label}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{o.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <Field
              label={option.id === 'card' ? 'New credit line (limit)' : 'Loan amount'}
              value={amountStr}
              onChange={setAmountStr}
              placeholder={option.id === 'card' ? '5,000' : option.id === 'mortgage' ? '250,000' : '10,000'}
            />

            {option.id === 'card' && (
              <Field
                label="Starting balance (leave $0 if you plan to keep it at zero)"
                value={balanceStr}
                onChange={setBalanceStr}
                placeholder="0"
              />
            )}

            {amount > 0 && (
              <p className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                <Clock className="w-3 h-3" /> {option.timeline}. Actual impact depends on the lender&apos;s scoring model.
              </p>
            )}
          </div>

          {/* Projections */}
          <div>
            {projections == null ? (
              <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center h-full flex items-center justify-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Enter an amount above to see how {option.label.toLowerCase()} would affect your FICO scores at each bureau.
                </p>
              </div>
            ) : projections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center h-full flex items-center justify-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  You need FICO scores entered.{' '}
                  <Link href="/fico-scores" className="text-blue-500 hover:underline">Go to FICO Scores</Link> to add them.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {projections.map(p => (
                  <div key={p.bureau} className={`p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 ${BUREAU_STYLES[p.bureau].lightBg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{p.bureau}</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${p.total > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : p.total < 0 ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {p.total > 0 ? `+${p.total}` : p.total} pts
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{p.currentScore}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                      <span className={`text-sm font-bold ${p.total > 0 ? 'text-emerald-600 dark:text-emerald-400' : p.total < 0 ? 'text-red-500' : ''}`}>{p.projected}</span>
                    </div>
                    <p className={`text-[10px] font-medium ${scoreColor(p.projected)}`}>
                      {scoreLabel(p.currentScore)} → {scoreLabel(p.projected)}
                    </p>
                    <div className="mt-2 space-y-1">
                      {p.drivers.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                          <span className="pr-2">{d.label}</span>
                          <span className={d.impact > 0 ? 'text-emerald-600 dark:text-emerald-400' : d.impact < 0 ? 'text-red-500' : ''}>
                            {d.impact > 0 ? '+' : ''}{d.impact} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              <p className="font-semibold mb-1">Will it help or hurt?</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Credit cards</strong> help most when you carry a low balance on a decent limit — adding available credit lowers your utilization. Adding a card while keeping it near max does little good.</li>
                <li><strong>Installment loans</strong> (personal, auto) help if you have no installment account yet — diversifying your credit mix is roughly 10% of your FICO score.</li>
                <li><strong>Every new account</strong> adds a hard inquiry (−5 pts) and lowers average account age, so the short-term dip is normal. Recovery takes about 6–12 months.</li>
              </ul>
            </div>
          </div>
        </div>

        {scoresLoading && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
            <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin" />
            Loading your FICO scores...
          </div>
        )}
      </CardContent>
    </Card>
  )
}