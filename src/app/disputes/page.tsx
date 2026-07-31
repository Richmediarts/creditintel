'use client'

import React, { useState, useEffect } from 'react'
import {
  FileText, Plus, Clock, CheckCircle2, AlertTriangle,
  ArrowLeft, Calendar, Trash2, Bell, Printer, Send, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { useCredit } from '@/lib/store/creditStore'
import { useRouter } from 'next/navigation'
import type { DisputeTracking, DisputeStatus, Bureau, LetterType, DisputeItem } from '@/types'

const STATUS_LABELS: Record<DisputeStatus, string> = {
  printed: 'Printed',
  sent: 'Sent',
  pending: 'Pending',
  resend: 'Resend',
  complete: 'Complete',
}

const STATUS_ICONS: Record<DisputeStatus, React.ReactNode> = {
  printed: <Printer className="w-4 h-4" />,
  sent: <Send className="w-4 h-4" />,
  pending: <Clock className="w-4 h-4" />,
  resend: <RefreshCw className="w-4 h-4" />,
  complete: <CheckCircle2 className="w-4 h-4" />,
}

const BUREAUS: Bureau[] = ['Experian', 'Equifax', 'TransUnion']
const INACCURACY_OPTIONS = [
  'balance', 'late_payment', 'not_my_account', 'duplicate',
  'obsolete', 'identity_theft', 'missing_payment', 'fcra_violation',
]
const LETTER_TYPES: { value: LetterType; label: string; waitDays: number }[] = [
  { value: 'validation', label: 'Validation Request', waitDays: 30 },
  { value: 'dispute', label: 'CRA Dispute & Deletion Demand', waitDays: 30 },
  { value: 'revocation', label: 'Revocation of Authorization', waitDays: 15 },
]

const STATUS_ORDER: DisputeStatus[] = ['printed', 'sent', 'pending', 'resend', 'complete']

function StatusCell({
  status,
  dispute,
  onAdvance,
}: {
  status: DisputeStatus
  dispute: DisputeTracking
  onAdvance: (id: number, status: DisputeStatus) => void
}) {
  const dateKey = `${status}At` as keyof DisputeTracking
  const dateVal = dispute[dateKey] as string | null
  const statusIdx = STATUS_ORDER.indexOf(dispute.status)
  const thisIdx = STATUS_ORDER.indexOf(status)
  const isComplete = dispute.status === 'complete'
  const isActive = statusIdx >= thisIdx && !isComplete
  const isNext = thisIdx === statusIdx + 1 || (statusIdx === -1 && thisIdx === 0)

  if (dateVal) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-green-500">{STATUS_ICONS[status]}</span>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
          {new Date(dateVal).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    )
  }

  if (isComplete) return <span className="text-sm text-gray-400 font-medium">—</span>

  if (isNext) {
    return (
      <button
        onClick={() => onAdvance(dispute.id, status)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded border border-dashed
          border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400
          hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400
          transition-colors"
      >
        {STATUS_ICONS[status]}
        {STATUS_LABELS[status]}
      </button>
    )
  }

  return <span className="text-[11px] text-gray-400">—</span>
}

export default function DisputesPage() {
  const { user, loading: authLoading } = useAuth()
  const { state: creditState } = useCredit()
  const router = useRouter()
  const [disputes, setDisputes] = useState<DisputeTracking[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [reminders, setReminders] = useState<{ overdue: any[]; dueSoon: any[] }>({ overdue: [], dueSoon: [] })

  const [creditorName, setCreditorName] = useState('')
  const [bureau, setBureau] = useState<Bureau>('Experian')
  const [inaccuracies, setInaccuracies] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [letterType, setLetterType] = useState<LetterType>('validation')

  const disputeItems = creditState?.creditData?.disputeItems ?? []

  const fetchDisputes = async () => {
    const res = await fetch('/api/disputes')
    if (res.ok) {
      const data = await res.json()
      setDisputes(data.disputes)
    }
    setLoading(false)
  }

  const fetchReminders = async () => {
    const res = await fetch('/api/disputes/reminders')
    if (res.ok) {
      const data = await res.json()
      setReminders(data)
    }
  }

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) {
      fetchDisputes()
      fetchReminders()
    }
  }, [user, authLoading])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creditorName,
        bureau,
        inaccuracies,
        letterType,
        notes,
      }),
    })
    if (res.ok) {
      setShowAdd(false)
      setCreditorName('')
      setInaccuracies([])
      setNotes('')
      setLetterType('validation')
      fetchDisputes()
      fetchReminders()
    }
  }

  const handleAddFromItem = async (item: DisputeItem) => {
    await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creditorName: item.creditorName,
        bureau: item.bureau,
        inaccuracies: item.inaccuracies,
        letterType: 'validation',
        notes: item.recommendedAction || '',
      }),
    })
    fetchDisputes()
    fetchReminders()
  }

  const handleAdvance = async (id: number, status: DisputeStatus) => {
    const body: Record<string, string> = { status }
    const now = new Date().toISOString()
    const nowDate = now.split('T')[0]
    const dateKey = `${status}At`
    body[dateKey] = now

    await fetch(`/api/disputes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    fetchDisputes()
    fetchReminders()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this dispute tracking entry?')) return
    await fetch(`/api/disputes/${id}`, { method: 'DELETE' })
    fetchDisputes()
    fetchReminders()
  }

  const toggleInaccuracy = (val: string) => {
    setInaccuracies(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    )
  }

  const alreadyTracked = new Set(disputes.map(d => `${d.creditorName}|${d.bureau}`))
  const untrackedItems = disputeItems.filter(item => !alreadyTracked.has(`${item.creditorName}|${item.bureau}`))

  if (authLoading) return <div className="text-center py-20 text-gray-500">Loading...</div>
  if (!user) return null

  const reminderCount = reminders.overdue.length + reminders.dueSoon.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dispute Tracker</h1>
          {reminderCount > 0 && (
            <Link href="#reminders">
              <Badge variant="danger" className="cursor-pointer text-sm font-bold">
                <Bell className="w-4 h-4 mr-1" /> {reminderCount} reminder{reminderCount > 1 ? 's' : ''}
              </Badge>
            </Link>
          )}
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" /> Track Dispute</Button>
      </div>

      {/* Reminders */}
      {(reminders.overdue.length > 0 || reminders.dueSoon.length > 0) && (
        <div id="reminders" className="space-y-2">
          {reminders.overdue.length > 0 && (
            <Card className="border-red-300 dark:border-red-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-base font-semibold text-red-600 dark:text-red-400">Overdue Response{reminders.overdue.length > 1 ? 's' : ''}</span>
                </div>
                {reminders.overdue.map((r: any) => (
                  <div key={r.id} className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 py-1.5">
                    <Badge variant={r.bureau === 'Experian' ? 'info' : r.bureau === 'Equifax' ? 'success' : 'default'}>{r.bureau}</Badge>
                    <span className="font-semibold">{r.creditorName}</span>
                    <span className="text-red-500 text-sm">Expected: {r.expectedResponseDate}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {reminders.dueSoon.length > 0 && (
            <Card className="border-yellow-300 dark:border-yellow-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span className="text-base font-semibold text-yellow-600 dark:text-yellow-400">Due Within 7 Days</span>
                </div>
                {reminders.dueSoon.map((r: any) => (
                  <div key={r.id} className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 py-1.5">
                    <Badge variant={r.bureau === 'Experian' ? 'info' : r.bureau === 'Equifax' ? 'success' : 'default'}>{r.bureau}</Badge>
                    <span className="font-semibold">{r.creditorName}</span>
                    <span className="text-yellow-500 text-sm">{r.daysUntil}d remaining</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Add Dispute Form */}
      {showAdd && (
        <Card>
          <CardContent className="p-4">
            <CardTitle className="mb-3">Track New Dispute</CardTitle>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  value={creditorName} onChange={e => setCreditorName(e.target.value)}
                  placeholder="Creditor Name" required
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                />
                <select
                  value={bureau} onChange={e => setBureau(e.target.value as Bureau)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                >
                  {BUREAUS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select
                  value={letterType} onChange={e => setLetterType(e.target.value as LetterType)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                >
                  {LETTER_TYPES.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                {INACCURACY_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleInaccuracy(opt)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                      inaccuracies.includes(opt)
                        ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400'
                        : 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400 hover:border-blue-300'
                    }`}
                  >
                    {opt.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button type="submit">Track Dispute</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tracked Disputes */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-gray-500 p-4">Loading...</p>
          ) : disputes.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-base font-medium">No disputes tracked yet</p>
              <p className="text-sm mt-1">Add items from your report or manually above</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {disputes.map(d => {
                const ltInfo = LETTER_TYPES.find(lt => lt.value === d.letterType)
                return (
                  <div key={d.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-semibold text-gray-900 dark:text-white">{d.creditorName}</span>
                          <Badge>{d.bureau}</Badge>
                          <Badge variant="info" className="text-xs">{ltInfo?.label || d.letterType}</Badge>
                        </div>
                        {d.inaccuracies.length > 0 && (
                          <div className="flex gap-1 flex-wrap mb-2">
                            {d.inaccuracies.map((inacc, i) => (
                              <Badge key={i} variant="warning" className="text-xs font-medium">{inacc.replace(/_/g, ' ')}</Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          {/* Status milestones */}
                          <div className="flex items-center gap-4">
                            {STATUS_ORDER.map(s => (
                              <StatusCell key={s} status={s} dispute={d} onAdvance={handleAdvance} />
                            ))}
                          </div>
                          {d.expectedResponseDate && d.status !== 'complete' && (
                            <span className={`flex items-center gap-1 font-medium ${d.isOverdue ? 'text-red-500' : ''}`}>
                              <Calendar className="w-4 h-4" />
                              {d.isOverdue ? 'Overdue' : `${d.daysUntilResponse}d left`} (by {d.expectedResponseDate})
                            </span>
                          )}
                        </div>
                        {d.notes && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 italic font-medium">{d.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded ml-4 shrink-0"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dispute Items from Report */}
      {untrackedItems.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <CardTitle className="mb-3">Dispute Items from Your Report</CardTitle>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              These items were found in your credit report. Click to add them to the tracker.
            </p>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {untrackedItems.map((item, i) => (
                <div key={i} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-gray-900 dark:text-white">{item.creditorName}</span>
                    <Badge>{item.bureau}</Badge>
                    {item.inaccuracies.slice(0, 3).map((inacc, j) => (
                      <Badge key={j} variant="warning" className="text-xs font-medium">{inacc.replace(/_/g, ' ')}</Badge>
                    ))}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => handleAddFromItem(item)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Track
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}