'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users, Shield, Heart, PlusCircle, Share2, Lock, Unlock, Check, X,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status'
import { useAuth } from '@/lib/auth-context'

interface Household {
  id: number
  created_by: number
  name: string
  unconfirmed_reserve: number
  cushion_target: number
  split_mode: string
}

interface Member {
  user_id: number
  name: string
  email: string
  role: string
  share_level: 'details' | 'totals' | 'none'
  is_owner: boolean
}

interface Contribution {
  id: number
  amount: number
  notes: string
  created_at: string
}

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const SHARE_LEVELS = [
  { value: 'details', label: 'Share my details', desc: 'Bills I add are visible to the household' },
  { value: 'totals', label: 'Share totals only', desc: 'Only my contributed total is visible' },
  { value: 'none', label: 'Share nothing', desc: 'Keep my entries private to me' },
]

export default function HouseholdPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [household, setHousehold] = useState<Household | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const [nameInput, setNameInput] = useState('')
  const [unconfirmedInput, setUnconfirmedInput] = useState('')
  const [cushionInput, setCushionInput] = useState('')
  const [splitMode, setSplitMode] = useState('50/50')
  const [joinEmail, setJoinEmail] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [contributionInput, setContributionInput] = useState('')
  const [contributionNote, setContributionNote] = useState('')

  const fetchAll = useCallback(async () => {
    const res = await fetch('/api/budget/household')
    if (res.ok) {
      const data = await res.json()
      setHousehold(data.household)
      setMembers(data.members || [])
      setContributions(data.contributions || [])
      setIsOwner(!!data.isOwner)
      setNameInput(data.household?.name || '')
      setUnconfirmedInput(String(data.household?.unconfirmed_reserve ?? ''))
      setCushionInput(String(data.household?.cushion_target ?? ''))
      setSplitMode(data.household?.split_mode || '50/50')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchAll()
  }, [user, authLoading, fetchAll])

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 6000) }

  const saveSettings = async () => {
    const res = await fetch('/api/budget/household', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nameInput,
        unconfirmed_reserve: parseFloat(unconfirmedInput) || 0,
        cushion_target: parseFloat(cushionInput) || 0,
        split_mode: splitMode,
      }),
    })
    if (res.ok) {
      flash('Household settings saved.')
      await fetchAll()
    } else {
      const d = await res.json()
      setError(d.error || 'Failed to save')
      setTimeout(() => setError(''), 5000)
    }
  }

  const setShareLevel = async (level: string) => {
    if (!user) return
    await fetch('/api/budget/household', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ share_level: level }),
    })
    flash('Sharing preference saved.')
    await fetchAll()
  }

  const createInvite = async () => {
    try {
      const response = await fetch('/api/budget/household', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ create_invite: true }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to create invitation.')
      setInviteCode(data.invite_code)
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to create invitation.') }
  }

  const joinHousehold = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/budget/household', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: joinEmail }),
    })
    const data = await res.json()
    if (res.ok) {
      flash('Joined the household — you now see the shared pay-period plan.')
      await fetchAll()
    } else {
      setError(data.error || 'Failed to join')
      setTimeout(() => setError(''), 5000)
    }
  }

  const addContribution = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/budget/household', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contribution: parseFloat(contributionInput) || 0,
        contribution_notes: contributionNote,
      }),
    })
    if (res.ok) {
      setContributionInput('')
      setContributionNote('')
      flash('Contribution recorded toward the household plan.')
      await fetchAll()
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Shared Household</h1>
          <p className="text-sm text-gray-500">Coordinate who pays what, contribute details, control what you share.</p>
        </div>
        <Link href="/budget"><Button variant="secondary">← Back to Pay-Period Dashboard</Button></Link>
      </div>

      {notice && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" /> {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {/* Members */}
      <Card className="lift">
        <CardContent className="p-5">
          <CardTitle className="text-base flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /> {household?.name || 'Our Household'}
          </CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {members.map((m) => (
              <div key={m.user_id} className="rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <span role="img" aria-hidden="true">{m.is_owner ? '👑' : '👤'}</span> {m.name}
                    {m.is_owner && <StatusPill status="info" label="Budget owner" />}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{m.email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">Shares</span>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {m.share_level === 'details' ? (
                      <Unlock className="w-4 h-4 inline text-emerald-600" aria-label="details" />
                    ) : m.share_level === 'totals' ? (
                      <Shield className="w-4 h-4 inline text-amber-600" aria-label="totals only" />
                    ) : (
                      <Lock className="w-4 h-4 inline text-gray-500" aria-label="nothing" />
                    )}{' '}
                    {m.share_level}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* My privacy */}
      <Card className="lift">
        <CardContent className="p-5">
          <CardTitle className="text-base flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" /> What I share
          </CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Your spouse never has to connect accounts or reveal everything. Bills you add to the shared list
            show as &ldquo;Spouse&apos;s&rdquo; — you choose how much detail the household sees.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SHARE_LEVELS.map((lvl) => (
              <button
                key={lvl.value}
                onClick={() => setShareLevel(lvl.value)}
                className={`text-left rounded-xl border-2 p-4 transition-all ${
                  members.find((m) => m.user_id === user?.id)?.share_level === lvl.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                }`}
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{lvl.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{lvl.desc}</p>
              </button>
            ))}
          </div>

          {/* Contribution */}
          <div className="mt-5 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4">
            <CardTitle className="text-sm mb-1 flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" /> Contribute without connecting accounts
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Enter a total monthly contribution, or add individual bills on the{' '}
              <Link href="/budget/bills" className="underline">Bills page</Link> choosing &ldquo;Spouse&apos;s&rdquo;.
            </p>
            <form onSubmit={addContribution} className="flex flex-wrap gap-2">
              <input
                type="number" step="0.01" min="0" required
                placeholder="Amount $"
                value={contributionInput}
                onChange={(e) => setContributionInput(e.target.value)}
                className="w-32 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text" placeholder="Note (optional)"
                value={contributionNote}
                onChange={(e) => setContributionNote(e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button type="submit" size="sm"><PlusCircle className="w-4 h-4 mr-1" /> Record</Button>
            </form>
            {contributions.length > 0 && (
              <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
                {contributions.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs py-1.5">
                    <span className="text-gray-500 dark:text-gray-400">
                      {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {c.notes ? ` — ${c.notes}` : ''}
                    </span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{fmt(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Join household */}
      {!members.some((m) => m.user_id === user?.id && !m.is_owner) && (
        <Card className="lift">
          <CardContent className="p-5">
            <CardTitle className="text-base flex items-center gap-2 mb-1">
              <Share2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /> Join your spouse&apos;s household
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Enter the one-time invitation code supplied by the household owner.
              You keep your own login and privacy settings.
            </p>
            <form onSubmit={joinHousehold} className="flex flex-wrap gap-2">
              <input
                type="text" required aria-label="Household invitation code"
                placeholder="Invitation code"
                value={joinEmail}
                onChange={(e) => setJoinEmail(e.target.value)}
                className="flex-1 min-w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button type="submit">Join</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isOwner && <Card><CardContent><CardTitle>Invite your spouse</CardTitle><p className="mt-2 mb-3 text-sm text-gray-500 dark:text-gray-400">Create a one-time code, valid for 24 hours, and share it with your spouse. Joining grants access to this household’s shared plan.</p><Button onClick={createInvite}>Create invitation code</Button>{inviteCode && <div role="status" className="mt-3"><label className="block text-xs font-semibold mb-1" htmlFor="household-invite">Copy this code for your spouse</label><input id="household-invite" readOnly value={inviteCode} className="w-full rounded-lg border border-indigo-300 bg-indigo-50 p-3 font-mono text-xs text-indigo-950" onFocus={e => e.target.select()} /><p className="mt-2 text-xs text-gray-500">Generating another code replaces this one.</p></div>}</CardContent></Card>}

      {/* Household settings (owner) */}
      {isOwner ? (
        <Card className="lift">
          <CardContent className="p-5">
            <CardTitle className="text-base flex items-center gap-2 mb-3">Household Settings</CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Household name</label>
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Shared-cost split mode</label>
                <select
                  value={splitMode}
                  onChange={(e) => setSplitMode(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="50/50">Split shared bills 50 / 50</option>
                  <option value="custom">Custom per-bill percentages</option>
                  <option value="owner">I cover shared bills</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Unconfirmed-expense reserve ($ per pay period)
                </label>
                <input
                  type="number" step="0.01" min="0"
                  value={unconfirmedInput}
                  onChange={(e) => setUnconfirmedInput(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">Covers unknown household bills — subtracted from &ldquo;available to spend&rdquo;, kept separate from &ldquo;remaining after known bills&rdquo;.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cash cushion target ($)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={cushionInput}
                  onChange={(e) => setCushionInput(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">The plan warns when projected end-of-period cash falls under this.</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={saveSettings}>Save settings</Button>
              <Button variant="ghost" onClick={fetchAll}><X className="w-4 h-4 mr-1" /> Reset</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 text-xs text-gray-400 text-center">
            Household settings (reserves, cushion, split) are managed by the budget owner. Ask them to adjust, or add
            your own bills &amp; contribution above — those flow into the shared plan.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
