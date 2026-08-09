'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { ArrowLeft, Copy, Check, Download, X } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { useCredit } from '@/lib/store/creditStore'
import { generateRevocationLetter, generateValidationRequest, generateCombinedDisputeLetter, generateInquiryDisputeLetter, letterTextToDocx, resolveDisputeTarget } from '@/lib/utils/disputeLetters'
import type { DisputeItem } from '@/types'

function DisputeLettersContent() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const { state } = useCredit()
  const { creditData } = state
  const [selectedBureau, setSelectedBureau] = useState<string>('all')
  const [consumerName, setConsumerName] = useState(user?.name || 'Consumer')
  const [consumerAddress, setConsumerAddress] = useState('52 BIRCH RIVER XING, DALLAS, GA 30132')
  const [copied, setCopied] = useState(false)
  const [downloadingDocx, setDownloadingDocx] = useState(false)
  const [trackedMessage, setTrackedMessage] = useState('')
  const [letterType, setLetterType] = useState<'dispute' | 'revocation' | 'validation' | 'inquiry'>('validation')
  const [target, setTarget] = useState<ReturnType<typeof resolveDisputeTarget> | null>(null)

  useEffect(() => {
    if (!creditData) return
    const resolved = resolveDisputeTarget(creditData, {
      bureau: searchParams.get('bureau'),
      creditor: searchParams.get('creditor'),
      kind: searchParams.get('kind'),
    })
    setTarget(resolved)
    if (resolved) {
      setSelectedBureau(resolved.item.bureau)
      setLetterType(resolved.letterType)
    }
  }, [creditData, searchParams])

  if (!creditData) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <p>No credit data available. Upload reports first.</p>
        <Link href="/upload" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Go to Upload Center</Link>
      </div>
    )
  }

  const bureaus = creditData.reports.map(r => r.bureau)
  const disputeItems = target
    ? [target.item]
    : selectedBureau === 'all'
      ? creditData.disputeItems
      : creditData.disputeItems.filter(d => d.bureau === selectedBureau)

  let letterContent = ''
  if (letterType === 'dispute') {
    letterContent = generateCombinedDisputeLetter(creditData.reports, disputeItems, consumerName, consumerAddress)
  } else if (letterType === 'inquiry' && disputeItems.length > 0) {
    const item = disputeItems[0]
    letterContent = generateInquiryDisputeLetter(item.bureau, item.creditorName, item.inquiryDate || 'Unknown', consumerName, consumerAddress).body
  } else if (letterType === 'revocation' && disputeItems.length > 0) {
    const item = disputeItems[0]
    letterContent = generateRevocationLetter(item.bureau, item.creditorName, consumerName, consumerAddress).body
  } else if (letterType === 'validation' && disputeItems.length > 0) {
    const item = disputeItems[0]
    letterContent = generateValidationRequest(item.bureau, item.creditorName, consumerName, consumerAddress).body
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(letterContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const trackPrinted = async () => {
    if (disputeItems.length === 0 || letterType === 'dispute') return
    const item = disputeItems[0]

    const listRes = await fetch('/api/disputes')
    if (listRes.ok) {
      const { disputes } = await listRes.json()
      const already = disputes.find((d: { creditorName: string; bureau: string }) =>
        d.creditorName === item.creditorName && d.bureau === item.bureau
      )
      if (already) {
        setTrackedMessage(`"${item.creditorName}" is already in the Dispute Tracker.`)
        return
      }
    }

    const res = await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creditorName: item.creditorName,
        bureau: item.bureau,
        inaccuracies: item.inaccuracies,
        letterType,
        notes: `Printed via Dispute Letter Generator (${new Date().toLocaleString()})`,
      }),
    })
    if (res.ok) {
      setTrackedMessage(`Marked "${item.creditorName}" as Printed in the Dispute Tracker.`)
    } else {
      const err = await res.json().catch(() => null)
      setTrackedMessage(err?.error ? `Could not track: ${err.error}` : '')
    }
  }

  const letterTypeLabels: Record<string, string> = {
    dispute: 'CRA_Dispute_and_Deletion_Demand',
    revocation: 'Revocation_of_Authorization',
    validation: 'Validation_Request',
    inquiry: 'Unauthorized_Inquiry_Dispute',
  }
  const bureauPrefix = selectedBureau !== 'all' ? `${selectedBureau}_` : ''
  const defaultName = `${letterTypeLabels[letterType]}_${bureauPrefix}${new Date().toISOString().split('T')[0]}`

  const downloadBlob = async (blob: Blob, ext: string, mime: string) => {
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `${defaultName}.${ext}`,
          types: [{ description: ext.toUpperCase(), accept: { [mime]: [`.${ext}`] } }],
        })
        const writable = await (handle as any).createWritable()
        await (writable as any).write(blob)
        await (writable as any).close()
        return
      } catch { /* user cancelled or API unavailable — fall through */ }
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${defaultName}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownload = async () => {
    await trackPrinted()
    await downloadBlob(new Blob([letterContent], { type: 'text/plain' }), 'txt', 'text/plain')
  }

  const handleDownloadDocx = async () => {
    setDownloadingDocx(true)
    try {
      await trackPrinted()
      const blob = await letterTextToDocx(letterContent)
      await downloadBlob(blob, 'docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    } finally {
      setDownloadingDocx(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dispute Letter Generator</h1>
      </div>

      {target && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-300">
            <span className="font-medium">Disputing:</span>
            <span className="font-semibold">{target.item.creditorName}</span>
            <Badge>{target.item.bureau}</Badge>
          </div>
          <Link href="/dispute-letters" className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 hover:underline">
            <X className="w-3 h-3" /> Clear
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="p-4">
              <CardTitle className="mb-3">Settings</CardTitle>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Consumer Name</label>
                  <input
                    type="text"
                    value={consumerName}
                    onChange={e => setConsumerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Address</label>
                  <textarea
                    value={consumerAddress}
                    onChange={e => setConsumerAddress(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Letter Type</label>
                  <select
                    value={letterType}
                    onChange={e => setLetterType(e.target.value as 'dispute' | 'revocation' | 'validation' | 'inquiry')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="dispute">CRA Dispute & Deletion Demand</option>
                    <option value="revocation">Revocation of Authorization</option>
                    <option value="validation">Validation Request</option>
                    <option value="inquiry">Inquiry Dispute (Unauthorized Hard Inquiry)</option>
                  </select>
                  {letterType === 'dispute' && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-[11px] font-medium text-blue-700 dark:text-blue-300">CRA Dispute &amp; Deletion Demand</p>
                      <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-1 leading-relaxed">
                        <strong>Order:</strong> Send <strong>second</strong> — after sending Validation Request (if applicable) or directly if the error is clear.
                      </p>
                      <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-1 leading-relaxed">
                        <strong>When to use:</strong> You found inaccurate, incomplete, or unverifiable items on your credit report — wrong balances, late payments that were on time, accounts that aren&apos;t yours, obsolete items, or duplicate entries.
                      </p>
                      <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-1 leading-relaxed">
                        <strong>Why:</strong> FCRA §611(a) requires bureaus to investigate and remove inaccurate or unverifiable information within 30 days. This letter formally demands deletion.
                      </p>
                      <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-1 leading-relaxed">
                        <strong>How:</strong> Select the items you want to dispute, pick the target bureau, and mail via Certified Mail. Keep the green receipt as proof.
                      </p>
                    </div>
                  )}
                  {letterType === 'revocation' && (
                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Revocation of Authorization</p>
                      <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-1 leading-relaxed">
                        <strong>Order:</strong> Send <strong>anytime</strong> — standalone action, not part of the dispute sequence.
                      </p>
                      <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-1 leading-relaxed">
                        <strong>When to use:</strong> A creditor previously had your permission to pull your credit (e.g., for a pre-approved offer or existing account), and you want to revoke that permission going forward. Also used to revoke prior authorization for a specific account.
                      </p>
                      <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-1 leading-relaxed">
                        <strong>Why:</strong> FCRA §604 requires permissible purpose for any credit pull. Revoking authorization removes that permissible purpose. Future pulls without authorization can be pursued as FCRA violations.
                      </p>
                      <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-1 leading-relaxed">
                        <strong>How:</strong> Select the specific account/creditor, choose the bureau showing the inquiry or authorization, send Certified Mail.
                      </p>
                    </div>
                  )}
                  {letterType === 'validation' && (
                    <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                      <p className="text-[11px] font-medium text-purple-700 dark:text-purple-300">Validation Request</p>
                      <p className="text-[10px] text-purple-600/70 dark:text-purple-400/70 mt-1 leading-relaxed">
                        <strong>Order:</strong> Send <strong>first</strong> — before any dispute letter. Always validate a debt before disputing it.
                      </p>
                      <p className="text-[10px] text-purple-600/70 dark:text-purple-400/70 mt-1 leading-relaxed">
                        <strong>When to use:</strong> A debt collector or collection agency is reporting a debt on your credit report. Send this within 30 days of first contact to force them to prove the debt is yours, accurate, and collectible.
                      </p>
                      <p className="text-[10px] text-purple-600/70 dark:text-purple-400/70 mt-1 leading-relaxed">
                        <strong>Why:</strong> FDCPA §809 and FCRA §623 give you the right to request validation. The collector must provide proof or cease collection and request deletion from credit reports.
                      </p>
                      <p className="text-[10px] text-purple-600/70 dark:text-purple-400/70 mt-1 leading-relaxed">
                        <strong>How:</strong> Select the collection account, choose the bureau, send Certified Mail within 30 days of first notice. If they can&apos;t validate, they must delete.
                      </p>
                    </div>
                  )}
                  {letterType === 'inquiry' && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-[11px] font-medium text-red-700 dark:text-red-300">Inquiry Dispute (Unauthorized Hard Inquiry)</p>
                      <p className="text-[10px] text-red-600/70 dark:text-red-400/70 mt-1 leading-relaxed">
                        <strong>Order:</strong> Send <strong>anytime</strong> — standalone action when a hard inquiry appears on your report that you never authorized.
                      </p>
                      <p className="text-[10px] text-red-600/70 dark:text-red-400/70 mt-1 leading-relaxed">
                        <strong>When to use:</strong> A company pulled your credit (hard inquiry) but you never applied for credit, opened an account, or otherwise gave them a permissible purpose to access your report.
                      </p>
                      <p className="text-[10px] text-red-600/70 dark:text-red-400/70 mt-1 leading-relaxed">
                        <strong>Why:</strong> FCRA 15 U.S.C. §1681b limits access to consumer reports to specific permissible purposes (e.g., extension of credit). An inquiry with no permissible purpose is a §1681b(f) violation and must be deleted.
                      </p>
                      <p className="text-[10px] text-red-600/70 dark:text-red-400/70 mt-1 leading-relaxed">
                        <strong>How:</strong> Pick a hard inquiry from the Inquiry Tracker (Dispute link), choose this letter type, send to the bureau via Certified Mail. Bureaus typically require the inquiry to be unauthorized to remove it.
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Target Bureau</label>
                  <select
                    value={selectedBureau}
                    onChange={e => setSelectedBureau(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="all">All Bureaus</option>
                    {bureaus.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <CardTitle className="mb-3">Where to Send Letters</CardTitle>
              <div className="space-y-3 text-sm">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="font-semibold text-blue-800 dark:text-blue-300 mb-0.5">Experian</p>
                  <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                    Experian Dispute Department<br />
                    P.O. Box 4500<br />
                    Allen, TX 75013
                  </p>
                </div>
                <div className="p-2.5 bg-green-50 dark:bg-emerald-900/20 rounded-lg border border-green-200 dark:border-emerald-800">
                  <p className="font-semibold text-green-800 dark:text-emerald-300 mb-0.5">Equifax</p>
                  <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                    Equifax Information Services LLC<br />
                    P.O. Box 740256<br />
                    Atlanta, GA 30374-0256
                  </p>
                </div>
                <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="font-semibold text-purple-800 dark:text-purple-300 mb-0.5">TransUnion</p>
                  <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                    TransUnion LLC<br />
                    Consumer Dispute Center<br />
                    P.O. Box 2000<br />
                    Chester, PA 19016-2000
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
                Send all letters via <strong>Certified Mail Return Receipt Requested</strong> via USPS for proof of delivery.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <CardTitle className="mb-3">FCRA Citations</CardTitle>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <p>• FCRA §604 - Permissible Purpose</p>
                <p>• FCRA §611(a) - Dispute Process</p>
                <p>• FCRA §623(a) - Furnisher Duties</p>
                <p>• FCRA §623(b) - Notice of Dispute</p>
                <p>• FCRA §§616-617 - Civil Liability</p>
                <p>• Cushman v. TransUnion</p>
                <p>• Metro 2 Guidelines</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <CardTitle>
                  Generated Letter
                  <Badge className="ml-2">
                    {letterType === 'dispute' ? 'Dispute' : letterType === 'revocation' ? 'Revocation' : letterType === 'inquiry' ? 'Inquiry Dispute' : 'Validation'}
                  </Badge>
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleDownload}>
                    <Download className="w-4 h-4" /> .txt
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleDownloadDocx} disabled={downloadingDocx}>
                    <Download className="w-4 h-4" /> {downloadingDocx ? '...' : '.docx'}
                  </Button>
                </div>
              </div>
              {trackedMessage && (
                <div className="mb-3 p-2.5 rounded-lg bg-green-50 dark:bg-emerald-900/30 border border-green-200 dark:border-emerald-800 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-green-700 dark:text-emerald-300">{trackedMessage}</p>
                  <Link href="/disputes" className="text-xs text-green-700 dark:text-emerald-300 underline whitespace-nowrap">
                    View Tracker
                  </Link>
                </div>
              )}
              <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-[600px] overflow-y-auto border border-gray-200 dark:border-gray-700">
                {letterContent || 'Select dispute items and generate a letter...'}
              </pre>
            </CardContent>
          </Card>

          {/* Dispute Items */}
          <Card className="mt-4">
            <CardContent className="p-4">
              <CardTitle className="mb-3">Dispute Items ({disputeItems.length})</CardTitle>
              {disputeItems.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No dispute items available for the selected bureau</p>
              ) : (
                <div className="space-y-2">
                  {disputeItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                        <span className="text-sm text-gray-900 dark:text-white">{item.creditorName}</span>
                        <Badge>{item.bureau}</Badge>
                      </div>
                      <div className="flex gap-1">
                        {item.inaccuracies.map((inacc, j) => (
                          <Badge key={j} variant="warning" className="text-[10px]">{inacc.replace(/_/g, ' ')}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function DisputeLettersPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500"><p>Loading...</p></div>}>
      <DisputeLettersContent />
    </Suspense>
  )
}
