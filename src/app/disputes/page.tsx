'use client'

import React, { useState, useEffect } from 'react'
import {
  FileText, Plus, Clock, CheckCircle2, AlertTriangle,
  ArrowLeft, Calendar, Trash2, Bell,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import type { DisputeTracking, DisputeStatus, Bureau } from '@/types'

const STATUS_LABELS: Record<DisputeStatus, string> = {
  not_filed: 'Not Filed',
  filed: 'Filed',
  in_dispute: 'In Dispute',
  resolved: 'Resolved',
  closed: 'Closed',
}

const STATUS_VARIANTS: Record<DisputeStatus, 'default' | 'warning' | 'danger' | 'success' | 'info'> = {
  not_filed: 'default',
  filed: 'info',
  in_dispute: 'warning',
  resolved: 'success',
  closed: 'default',
}

const BUREAUS: Bureau[] = ['Experian', 'Equifax', 'TransUnion']
const INACCURACY_OPTIONS = [
  'balance', 'late_payment', 'not_my_account', 'duplicate',
  'obsolete', 'identity_theft', 'missing_payment', 'fcra_violation',
]

export default function DisputesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [disputes, setDisputes] = useState<DisputeTracking[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [reminders, setReminders] = useState<{ overdue: any[]; dueSoon: any[] }>({ overdue: [], dueSoon: [] })

  // New dispute form state
  const [creditorName, setCreditorName] = useState('')
  const [bureau, setBureau] = useState<Bureau>('Experian')
  const [inaccuracies, setInaccuracies] = useState<string[]>([])
  const [filedDate, setFiledDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

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
        filedDate,
        notes,
        status: 'filed',
      }),
    })
    if (res.ok) {
      setShowAdd(false)
      setCreditorName('')
      setInaccuracies([])
      setFiledDate(new Date().toISOString().split('T')[0])
      setNotes('')
      fetchDisputes()
      fetchReminders()
    }
  }

  const handleStatusUpdate = async (id: number, status: DisputeStatus) => {
    const body: any = { status }
    if (status === 'resolved') {
      body.resolvedDate = new Date().toISOString().split('T')[0]
    }
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

  if (authLoading) return <div className="text-center py-20 text-gray-500">Loading...</div>
  if (!user) return null

  const reminderCount = reminders.overdue.length + reminders.dueSoon.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dispute Tracker</h1>
          {reminderCount > 0 && (
            <Link href="#reminders">
              <Badge variant="danger" className="cursor-pointer">
                <Bell className="w-3 h-3 mr-1" /> {reminderCount} reminder{reminderCount > 1 ? 's' : ''}
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
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">Overdue Response{reminders.overdue.length > 1 ? 's' : ''}</span>
                </div>
                {reminders.overdue.map((r: any) => (
                  <div key={r.id} className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2 py-1">
                    <Badge variant={r.bureau === 'Experian' ? 'info' : r.bureau === 'Equifax' ? 'success' : 'default'}>{r.bureau}</Badge>
                    <span>{r.creditorName}</span>
                    <span className="text-red-500 text-xs">Expected: {r.expectedResponseDate}</span>
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
                  <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">Due Within 7 Days</span>
                </div>
                {reminders.dueSoon.map((r: any) => (
                  <div key={r.id} className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2 py-1">
                    <Badge variant={r.bureau === 'Experian' ? 'info' : r.bureau === 'Equifax' ? 'success' : 'default'}>{r.bureau}</Badge>
                    <span>{r.creditorName}</span>
                    <span className="text-yellow-500 text-xs">{r.daysUntil}d remaining</span>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                <input
                  type="date"
                  value={filedDate}
                  onChange={e => setFiledDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {INACCURACY_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleInaccuracy(opt)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
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

      {/* Disputes List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-gray-500 p-4">Loading...</p>
          ) : disputes.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No disputes tracked yet</p>
              <p className="text-xs mt-1">Track disputes to monitor status and get reminders</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {disputes.map(d => (
                <div key={d.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{d.creditorName}</span>
                        <Badge>{d.bureau}</Badge>
                        <Badge variant={STATUS_VARIANTS[d.status]}>{STATUS_LABELS[d.status]}</Badge>
                      </div>
                      {d.inaccuracies.length > 0 && (
                        <div className="flex gap-1 flex-wrap mb-2">
                          {d.inaccuracies.map((inacc, i) => (
                            <Badge key={i} variant="warning" className="text-[10px]">{inacc.replace(/_/g, ' ')}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        {d.filedDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Filed: {d.filedDate}
                          </span>
                        )}
                        {d.expectedResponseDate && d.status !== 'resolved' && d.status !== 'closed' && (
                          <span className={`flex items-center gap-1 ${d.isOverdue ? 'text-red-500' : ''}`}>
                            <Clock className="w-3 h-3" />
                            {d.isOverdue ? 'Overdue' : `${d.daysUntilResponse}d left`} (by {d.expectedResponseDate})
                          </span>
                        )}
                        {d.resolvedDate && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-3 h-3" /> Resolved: {d.resolvedDate}
                          </span>
                        )}
                      </div>
                      {d.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{d.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      {d.status !== 'resolved' && d.status !== 'closed' && (
                        <>
                          <button
                            onClick={() => handleStatusUpdate(d.id, 'resolved')}
                            className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                            title="Mark resolved"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          {d.status === 'filed' && (
                            <button
                              onClick={() => handleStatusUpdate(d.id, 'in_dispute')}
                              className="p-1.5 text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded"
                              title="Mark in dispute"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
