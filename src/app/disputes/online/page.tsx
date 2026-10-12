'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Monitor, Mail, ExternalLink, ShieldCheck, Info,
  AlertTriangle, CheckCircle2, Globe, Building2, Copy, Check,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { routeDispute } from '@/lib/utils/disputeRouting'
import type { Bureau, LetterType, DisputeTracking } from '@/types'

const BUREAUS: Bureau[] = ['Experian', 'Equifax', 'TransUnion']

const PORTAL_INFO: Record<Bureau, { url: string; label: string; phone: string; address: string }> = {
  Experian: {
    url: 'https://www.experian.com/disputes/main.html',
    label: 'Experian Online Dispute Center',
    phone: '1-888-397-3742',
    address: 'Experian, P.O. Box 4500, Allen, TX 75013',
  },
  Equifax: {
    url: 'https://www.equifax.com/personal/credit-report-services/credit-dispute/',
    label: 'Equifax Online Dispute Center',
    phone: '1-800-685-1111',
    address: 'Equifax Information Services LLC, P.O. Box 740256, Atlanta, GA 30374',
  },
  TransUnion: {
    url: 'https://dispute.transunion.com/',
    label: 'TransUnion Online Dispute Center',
    phone: '1-800-916-8800',
    address: 'TransUnion LLC, Consumer Dispute Center, P.O. Box 2000, Chester, PA 19016',
  },
}

const INACCURACIES = [
  'balance', 'late_payment', 'not_my_account', 'duplicate',
  'obsolete', 'identity_theft', 'missing_payment', 'fcra_violation',
]

const MAIL_ONLY = new Set(['identity_theft'])

export default function OnlineDisputePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [disputes, setDisputes] = useState<DisputeTracking[]>([])
  const [creditorName, setCredorName] = useState('')
  const [bureau, setBureau] = useState<Bureau>('Experian')
  const [letterType, setLetterType] = useState<LetterType>('dispute')
  const [inaccuracies, setInaccuracies] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [created, setCreated] = useState<{ id: number; method: string } | null>(null)

  const verdict = useMemo(
    () => routeDispute(bureau, inaccuracies, letterType),
    [bureau, inaccuracies, letterType]
  )

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (!user) return
    fetch('/api/disputes').then(r => r.json()).then(d => setDisputes(d.disputes || [])).catch(() => {})
  }, [user, authLoading])

  const toggle = (v: string) =>
    setInaccuracies(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])

  const trackAndOpen = async () => {
    const res = await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creditorName: creditorName.trim(),
        bureau,
        inaccuracies,
        letterType,
        method: verdict.method,
        notes: verdict.reasons.join(' '),
      }),
    })
    const data = await res.json()
    if (data.id) {
      setCreated({ id: data.id, method: data.method })
      const refreshed = await fetch('/api/disputes')
      const j = await refreshed.json()
      setDisputes(j.disputes || [])
    }
    window.open(verdict.portalUrl, '_blank', 'noopener,noreferrer')
  }

  const copySummary = async () => {
    const text = [
      `CREDIT REPORT DISPUTE — FCRA §611(a)(1)(A)`,
      ``,
      `Creditor / Furnisher: ${creditorName}`,
      `Credit Reporting Agency: ${bureau}`,
      `Items disputed: ${inaccuracies.join(', ') || '(none selected)'}`,
      ``,
      `I dispute the above information as inaccurate, incomplete, or unverifiable.`,
      `Pursuant to FCRA §611(a), I am exercising my right to dispute this information.`,
      `Pursuant to FCRA §623(b), I request written notice of the results of your investigation.`,
      ``,
      `If you cannot verify these items within 30 days, they must be corrected or deleted.`,
    ].join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (authLoading) return <div className="text-center py-20 text-gray-500">Loading...</div>
  if (!user) return null

  const openDisputes = disputes.filter(d => d.status !== 'complete')
  const mailFlagged = openDisputes.filter(d => d.requiresMail)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/disputes" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Online Dispute Center</h1>
            <p className="text-sm text-gray-500">File disputes through bureau portals and the CFPB. No printing required.</p>
          </div>
        </div>
        <Link href="/dispute-letters" className="text-sm text-blue-600 hover:underline">
          Need a physical letter instead?
        </Link>
      </div>

      {/* Mail-required banner */}
      {mailFlagged.length > 0 && (
        <Card className="border-red-300 dark:border-red-700 bg-red-50/60 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  {mailFlagged.length} dispute{mailFlagged.length > 1 ? 's' : ''} cannot be completed online
                </p>
                <ul className="mt-1 space-y-0.5">
                  {mailFlagged.map(d => (
                    <li key={d.id} className="text-xs text-red-600 dark:text-red-300">
                      <strong>{d.creditorName}</strong> ({d.bureau}) — {d.routing?.reasons?.[0] || 'physical letter required'}
                    </li>
                  ))}
                </ul>
                <Link href="/dispute-letters" className="inline-block mt-2 text-xs text-red-700 dark:text-red-300 underline font-medium">
                  Generate the required letter →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Builder */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5 space-y-4">
            <CardTitle className="text-sm">1. Describe the dispute</CardTitle>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Creditor / Furnisher</label>
                <input
                  value={creditorName}
                  onChange={e => setCredorName(e.target.value)}
                  placeholder="e.g. Capital One"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Bureau</label>
                <select
                  value={bureau}
                  onChange={e => setBureau(e.target.value as Bureau)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  {BUREAUS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Letter type</label>
              <select
                value={letterType}
                onChange={e => setLetterType(e.target.value as LetterType)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
              >
                <option value="dispute">CRA Dispute &amp; Deletion Demand</option>
                <option value="validation">Validation Request</option>
                <option value="inquiry">Inquiry Dispute (unauthorized hard pull)</option>
                <option value="revocation">Revocation of Authorization</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Reasons (select all that apply)</label>
              <div className="flex flex-wrap gap-2">
                {INACCURACIES.map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggle(i)}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      inaccuracies.includes(i)
                        ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400'
                        : 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400 hover:border-blue-300'
                    }`}
                  >
                    {i.replace(/_/g, ' ')}
                    {MAIL_ONLY.has(i) && <span className="ml-1 text-red-500">✉</span>}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">✉ = cannot be completed online</p>
            </div>

            {/* Verdict */}
            <div className={`rounded-lg border p-4 ${verdict.requiresMail ? 'border-red-300 dark:border-red-700 bg-red-50/60 dark:bg-red-950/20' : 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/20'}`}>
              <div className="flex items-start gap-3">
                {verdict.requiresMail
                  ? <Mail className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  : <Monitor className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${verdict.requiresMail ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                    {verdict.requiresMail ? 'PHYSICAL LETTER REQUIRED' : 'Can be filed online — no letter needed'}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {verdict.reasons.map((r, i) => (
                      <li key={i} className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{r}</li>
                    ))}
                    {verdict.reasons.length === 0 && (
                      <li className="text-xs text-gray-500">Select at least one reason to see how this dispute should be filed.</li>
                    )}
                  </ul>
                  {verdict.rules.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-300/50 dark:border-gray-700">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Governing law</p>
                      {verdict.rules.map((r, i) => (
                        <p key={i} className="text-[11px] text-gray-500 dark:text-gray-400">{r}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                onClick={trackAndOpen}
                disabled={!creditorName.trim()}
                variant={verdict.requiresMail ? 'secondary' : 'primary'}
              >
                {verdict.requiresMail ? <Mail className="w-4 h-4 mr-2" /> : <Globe className="w-4 h-4 mr-2" />}
                {verdict.requiresMail ? 'Track & Generate Letter' : `Open ${bureau} Portal`}
              </Button>
              <Button variant="secondary" onClick={copySummary}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied' : 'Copy dispute summary'}
              </Button>
            </div>

            {created && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Tracked as dispute #{created.id} via {created.method === 'online' ? 'online portal' : 'physical letter'}. Save the confirmation number the bureau gives you.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Bureau portals */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <CardTitle className="text-sm mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Bureau Portals
              </CardTitle>
              <div className="space-y-2.5">
                {BUREAUS.map(b => (
                  <div key={b} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{b}</p>
                    <a
                      href={PORTAL_INFO[b].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                    >
                      {PORTAL_INFO[b].label} <ExternalLink className="w-3 h-3" />
                    </a>
                    <p className="text-[11px] text-gray-500 mt-1">Phone: {PORTAL_INFO[b].phone}</p>
                    <p className="text-[11px] text-gray-500">Mail: {PORTAL_INFO[b].address}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="p-5">
              <CardTitle className="text-sm mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-500" /> CFPB Complaint Portal
              </CardTitle>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                File a complaint with the Consumer Financial Protection Bureau. They route it to the bureau,
                track the response, and escalate if the bureau misses the 30-day deadline.
              </p>
              <a
                href="https://www.consumerfinance.gov/complaint/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                consumerfinance.gov/complaint <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">What to select</p>
                <ol className="text-[11px] text-gray-600 dark:text-gray-400 space-y-0.5 list-decimal list-inside">
                  <li>Category: <strong>Credit reporting</strong></li>
                  <li>Company: the bureau (Experian / Equifax / TransUnion)</li>
                  <li>Product: <strong>Credit reporting</strong></li>
                  <li>Describe the item, then paste the dispute summary</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <CardTitle className="text-sm mb-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-gray-500" /> Important distinction
              </CardTitle>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                The <strong>CFPB does not delete credit report items</strong>. It is a regulator that forwards
                your complaint to the bureau and monitors compliance. The item itself can only be corrected by
                the bureau under FCRA §611(a). That is why this page opens the bureau portal for the actual
                dispute and links the CFPB as the escalation and paper-trail channel.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Open online disputes */}
      <Card>
        <CardContent className="p-5">
          <CardTitle className="text-sm mb-3">Open disputes by channel</CardTitle>
          {openDisputes.length === 0 ? (
            <p className="text-sm text-gray-500">No open disputes.</p>
          ) : (
            <div className="space-y-2">
              {openDisputes.map(d => (
                <div key={d.id} className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{d.creditorName}</span>
                  <Badge>{d.bureau}</Badge>
                  {d.requiresMail
                    ? <Badge variant="danger"><Mail className="w-3 h-3 mr-1" />Physical letter required</Badge>
                    : <Badge variant="success"><Globe className="w-3 h-3 mr-1" />Online</Badge>}
                  {d.confirmationNumber && (
                    <span className="text-[11px] text-gray-500 font-mono">#{d.confirmationNumber}</span>
                  )}
                  <a
                    href={d.routing?.portalUrl || PORTAL_INFO[d.bureau].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    {d.requiresMail ? 'View mailing address' : 'Open portal'} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* When mail is required */}
      <Card className="border-amber-200 dark:border-amber-800">
        <CardContent className="p-5">
          <CardTitle className="text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> When a physical letter is required
          </CardTitle>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 list-disc list-inside">
            <li><strong>Identity theft (FCRA §611(a)(2)).</strong> The bureau must validate identity with an FTC Identity Theft Report, a signed theft affidavit, and a copy of government ID. No portal accepts this.</li>
            <li><strong>Revocation of Authorization.</strong> Ends your business relationship with the furnisher. Must be delivered to the bureau&apos;s compliance officer in writing.</li>
            <li><strong>Bankruptcy, judgment, or public record disputes.</strong> These frequently require certified court documents sent by mail.</li>
            <li><strong>Escalation after an online dispute fails.</strong> If the bureau misses the 30-day §611(a) deadline, send a second letter by certified mail and file a CFPB complaint.</li>
            <li><strong>Time-barred items.</strong> Items older than the FCRA 7-year limit sometimes need written proof and supporting documentation.</li>
          </ul>
          <p className="text-xs text-gray-500 mt-3">
            Any dispute flagged <Badge variant="danger" className="mx-1">Physical letter required</Badge> in your
            tracker has been routed to the letter generator with the correct FCRA citations attached.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
