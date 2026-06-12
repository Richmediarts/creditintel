'use client'

import React, { useState } from 'react'
import { ArrowLeft, Copy, Check, Download } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCredit } from '@/lib/store/creditStore'
import { generateRevocationLetter, generateValidationRequest, generateCombinedDisputeLetter, letterTextToDocx } from '@/lib/utils/disputeLetters'

export default function DisputeLettersPage() {
  const { state } = useCredit()
  const { creditData } = state
  const [selectedBureau, setSelectedBureau] = useState<string>('all')
  const [consumerName, setConsumerName] = useState('Richard Johnson')
  const [consumerAddress, setConsumerAddress] = useState('52 BIRCH RIVER XING, DALLAS, GA 30132')
  const [copied, setCopied] = useState(false)
  const [downloadingDocx, setDownloadingDocx] = useState(false)
  const [letterType, setLetterType] = useState<'dispute' | 'revocation' | 'validation'>('dispute')

  if (!creditData) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <p>No credit data available. Upload reports first.</p>
        <Link href="/upload" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Go to Upload Center</Link>
      </div>
    )
  }

  const bureaus = creditData.reports.map(r => r.bureau)
  const disputeItems = selectedBureau === 'all'
    ? creditData.disputeItems
    : creditData.disputeItems.filter(d => d.bureau === selectedBureau)

  let letterContent = ''
  if (letterType === 'dispute') {
    letterContent = generateCombinedDisputeLetter(creditData.reports, disputeItems, consumerName, consumerAddress)
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

  const handleDownload = () => {
    const blob = new Blob([letterContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dispute-letter-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadDocx = async () => {
    setDownloadingDocx(true)
    try {
      const blob = await letterTextToDocx(letterContent)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dispute-letter-${Date.now()}.docx`
      a.click()
      URL.revokeObjectURL(url)
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
                    onChange={e => setLetterType(e.target.value as 'dispute' | 'revocation' | 'validation')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="dispute">CRA Dispute & Deletion Demand</option>
                    <option value="revocation">Revocation of Authorization</option>
                    <option value="validation">Validation Request</option>
                  </select>
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
                    {letterType === 'dispute' ? 'Dispute' : letterType === 'revocation' ? 'Revocation' : 'Validation'}
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
