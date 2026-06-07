'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Pencil, Check, X, ExternalLink, AlertCircle, Info,
  Shield, CreditCard, Home, TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import type { Bureau, FicoScores } from '@/types'

const BUREAUS: Bureau[] = ['Experian', 'Equifax', 'TransUnion']
const BUREAU_COLORS: Record<Bureau, string> = {
  Experian: 'from-blue-500 to-blue-600',
  Equifax: 'from-emerald-500 to-emerald-600',
  TransUnion: 'from-purple-500 to-purple-600',
}
const BUREAU_BG: Record<Bureau, string> = {
  Experian: 'bg-blue-50 dark:bg-blue-950/30',
  Equifax: 'bg-emerald-50 dark:bg-emerald-950/30',
  TransUnion: 'bg-purple-50 dark:bg-purple-950/30',
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
  if (score < 740) return 'text-yellow-500'
  if (score < 800) return 'text-green-500'
  return 'text-emerald-500'
}

function scoreBadgeVariant(score: number): 'danger' | 'warning' | 'success' | 'info' {
  if (score < 580) return 'danger'
  if (score < 670) return 'warning'
  if (score < 740) return 'warning'
  return 'success'
}

function scoreBarColor(score: number): string {
  if (score < 580) return 'bg-red-500'
  if (score < 670) return 'bg-orange-500'
  if (score < 740) return 'bg-yellow-500'
  if (score < 800) return 'bg-green-500'
  return 'bg-emerald-600'
}

export default function FicoScoresPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [scores, setScores] = useState<FicoScores>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Bureau | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchScores()
  }, [user, authLoading])

  const fetchScores = async () => {
    const res = await fetch('/api/fico-scores')
    if (res.ok) {
      const data = await res.json()
      setScores(data.scores)
    }
    setLoading(false)
  }

  const handleEdit = (bureau: Bureau) => {
    const current = scores[bureau]?.score
    setEditValue(current ? String(current) : '')
    setEditing(bureau)
  }

  const handleSave = async (bureau: Bureau) => {
    const val = editValue.trim()
    if (!val) return
    const num = parseInt(val, 10)
    if (isNaN(num) || num < 300 || num > 850) return

    setSaving(true)
    await fetch('/api/fico-scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bureau, score: num }),
    })
    setEditing(null)
    setSaving(false)
    fetchScores()
  }

  const handleClear = async (bureau: Bureau) => {
    setSaving(true)
    await fetch('/api/fico-scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bureau, score: null }),
    })
    setEditing(null)
    setSaving(false)
    fetchScores()
  }

  if (authLoading) return <div className="text-center py-20 text-gray-500">Loading...</div>
  if (!user) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">FICO® Scores</h1>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BUREAUS.map(bureau => {
          const entry = scores[bureau]
          const score = entry?.score ?? null
          const dateUpdated = entry?.dateUpdated ?? null

          return (
            <Card key={bureau} className={`${BUREAU_BG[bureau]} border-t-4 border-t-transparent`}>
              <div className={`h-1.5 rounded-t-xl bg-gradient-to-r ${BUREAU_COLORS[bureau]}`} />
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900 dark:text-white">{bureau}</h3>
                  {score !== null && (
                    <button
                      onClick={() => handleEdit(bureau)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Edit score"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {editing === bureau ? (
                  <div className="space-y-3">
                    <input
                      type="number"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      min={300}
                      max={850}
                      placeholder="Enter score (300-850)"
                      autoFocus
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white text-center text-2xl font-bold"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSave(bureau)} disabled={saving} className="flex-1 justify-center">
                        <Check className="w-3.5 h-3.5 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(null)} className="flex-1 justify-center">
                        <X className="w-3.5 h-3.5 mr-1" /> Cancel
                      </Button>
                    </div>
                    {score !== null && (
                      <button
                        onClick={() => handleClear(bureau)}
                        className="text-xs text-gray-400 hover:text-red-500 w-full text-center"
                      >
                        Clear score
                      </button>
                    )}
                  </div>
                ) : score !== null ? (
                  <>
                    <div className="text-center py-2">
                      <p className={`text-5xl font-bold ${scoreColor(score)}`}>{score}</p>
                      <Badge variant={scoreBadgeVariant(score)} className="mt-2">{scoreLabel(score)}</Badge>
                    </div>
                    <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${scoreBarColor(score)}`}
                        style={{ width: `${((score - 300) / (850 - 300)) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>300</span>
                      <span>850</span>
                    </div>
                    {dateUpdated && (
                      <p className="text-[10px] text-gray-400 mt-2 text-center">
                        Updated: {new Date(dateUpdated).toLocaleDateString()}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">No score entered yet</p>
                    <Button size="sm" variant="secondary" onClick={() => handleEdit(bureau)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Enter Score
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Add All Button */}
      {Object.keys(scores).length === 0 && !loading && (
        <div className="text-center">
          <Button onClick={() => handleEdit('Experian')}>
            Add Your FICO Scores
          </Button>
        </div>
      )}

      {/* Score Range Reference */}
      <Card>
        <CardContent className="p-4">
          <CardTitle className="mb-3">FICO® Score Range</CardTitle>
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

      {/* Educational Content */}
      <Card>
        <CardContent className="p-5 space-y-5">
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500" /> Understanding FICO® Scores
          </CardTitle>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">What is FICO® Score 8?</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              FICO® Score 8 is the most widely used credit scoring model by lenders for credit card and personal loan decisions.
              Unlike VantageScore (which is commonly shown by free services like Credit Karma), FICO 8 is what most lenders
              actually use when evaluating your applications. There is no single free service that provides FICO 8 scores
              from all three bureaus.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Where to Get Your Free FICO® 8 Scores</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">Bureau</th>
                    <th className="text-left py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">Free FICO 8?</th>
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Best Source</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">Experian</td>
                    <td className="py-2 pr-3"><Badge variant="success">Yes</Badge></td>
                    <td className="py-2">
                      <a href="https://www.google.com/aclk?sa=L&ai=DChsSEwihpv6Og_aUAxX7NwgFHRfzGcgYACICCAEQAhoCbWQ&co=1&ase=2&gclid=Cj0KCQjwrZTRBhDSARIsAHidYfcUZ0ZWiCI_XfkndKvaQOLeZOUeFIqfl6hhs848Yh2Ot49AkpJs-M8aAsjoEALw_wcB&cid=CAASuwHkaJCML9wffFlfiQfY_uZSfq074MPZaLxriV85c4Yx6SXVAeEcRMVflbptIzGjE02hIFYg_lccmrKz6EvRAhWLGV1M8J_7il-Kb_DKxNZJCU74Tlhrss4VbRmNOo-Ln2evkpBixZYhVuhvXZsppLJ8VaJiSdBLJQS0SMbV68MHw53Y4XmOwfl0dCiFdITLfe7A47fdMQ6yjN59zdZejXCT3-BXkAKKdxIm2XanYqZBVdQK_xW-SScdikWc&cce=2&category=acrcp_v1_32&sig=AOD64_244ZkkPILm4zkdlmigxJYsy5ErWA&q&nis=4&adurl&ved=2ahUKEwio-veOg_aUAxVjrIkEHeEEMBYQ0Qx6BAgPEAE" target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        Experian Free Account <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">Equifax</td>
                    <td className="py-2 pr-3"><Badge variant="success">Yes</Badge></td>
                    <td className="py-2">
                      <a href="https://www.myfico.com" target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        myFICO Free Account <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">TransUnion</td>
                    <td className="py-2 pr-3"><Badge variant="success">Yes</Badge></td>
                    <td className="py-2">
                      <a href="https://www.capitalone.com/creditwise/" target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        Capital One CreditWise <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-blue-500" /> Experian FICO 8
              </h4>
              <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-0.5">
                <li>✔ Official Experian FICO® Score 8</li>
                <li>✔ Updates regularly</li>
                <li>✔ Free Experian report</li>
                <li>No credit card required</li>
              </ul>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
              <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-500" /> Equifax FICO 8
              </h4>
              <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-0.5">
                <li>✔ Official FICO® Score 8 on Equifax file</li>
                <li>✔ Free myFICO account</li>
                <li>✔ Monthly updates</li>
              </ul>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
              <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-purple-500" /> TransUnion FICO 8
              </h4>
              <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-0.5">
                <li>✔ Capital One CreditWise (free, no card required)</li>
                <li>✔ Free monitoring and alerts</li>
              </ul>
            </div>
          </div>

          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <h4 className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> What to Avoid
            </h4>
            <p className="text-[11px] text-red-600 dark:text-red-300 mb-1">
              These services provide <strong>VantageScore</strong>, not FICO 8:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-[11px] text-red-600 dark:text-red-300">
              <span>❌ Credit Karma</span>
              <span>❌ Credit Sesame</span>
              <span>❌ Chase Credit Journey</span>
              <span>❌ NerdWallet</span>
            </div>
            <p className="text-[11px] text-red-600 dark:text-red-300 mt-1">
              These are useful for monitoring changes but are not the FICO 8 score most lenders use.
            </p>
          </div>

          <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <h4 className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1 flex items-center gap-1">
              <Home className="w-3.5 h-3.5" /> If You're Preparing for a Mortgage
            </h4>
            <p className="text-[11px] text-yellow-600 dark:text-yellow-300 leading-relaxed">
              Mortgage lenders almost always use the older mortgage-specific FICO versions:
              <strong> Experian FICO 2, Equifax FICO 5, TransUnion FICO 4</strong>.
              These are not available for free. When you're about 30–60 days away from applying,
              purchase a one-month <a href="https://www.myfico.com" target="_blank" rel="noopener noreferrer"
                className="text-blue-600 hover:underline">myFICO</a> subscription to
              view your actual mortgage scores before you submit an application.
            </p>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Recommendation
            </h4>
            <div className="text-[11px] text-blue-600 dark:text-blue-300 space-y-1">
              <p><strong>Experian</strong> → Experian FICO 8 (free account)</p>
              <p><strong>myFICO</strong> → Equifax FICO 8 (free account)</p>
              <p><strong>Discover Credit Scorecard</strong> → TransUnion FICO 8 (free, no card needed)</p>
              <p className="pt-1">Then, 30–60 days before applying for a mortgage, get a one-month myFICO subscription for your actual FICO 2/4/5 mortgage scores.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
