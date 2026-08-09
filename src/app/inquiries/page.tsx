'use client'

import React, { useState } from 'react'
import { ArrowLeft, Search, FilePen, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCredit } from '@/lib/store/creditStore'
import { disputeLink } from '@/lib/utils/disputeLetters'
import { usePrintedDisputes } from '@/lib/usePrintedDisputes'
import { PrintedBadge } from '@/components/disputes/PrintedBadge'
import type { Bureau, Inquiry } from '@/types'

const GENERIC_WORDS = new Set([
  'bank', 'banks', 'credit', 'card', 'cards', 'fc', 'fcu', 'na', 'n.a', 'usa', 'us', 'llc', 'inc', 'corp',
  'company', 'co', 'services', 'service', 'financial', 'finance', 'group', 'holdings', 'the', 'of', 'auto',
  'motor', 'motors', 'national', 'america', 'american', 'united', 'states',
])

const SYNONYMS: Record<string, string> = {
  dept: 'department',
  co: 'company',
  svcs: 'services',
  bankna: 'bank',
}

function normalizeName(name: string): string {
  const expanded = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  return expanded.split(' ').map(w => SYNONYMS[w] || w).join(' ')
}

function isTiedToOpenAccount(inquiryName: string, openAccountNames: string[]): boolean {
  const tokens = normalizeName(inquiryName).split(' ').filter(t => t && !GENERIC_WORDS.has(t))
  if (tokens.length === 0) return true
  for (const accountName of openAccountNames) {
    const accountTokens = normalizeName(accountName).split(' ').filter(t => t && !GENERIC_WORDS.has(t))
    const matches = tokens.filter(t => accountTokens.includes(t)).length
    const minLen = Math.min(tokens.length, accountTokens.length)
    if (minLen > 0 && matches / minLen >= 0.6) return true
  }
  return false
}

export default function InquiriesPage() {
  const { state } = useCredit()
  const { creditData } = state
  const [unmatchedOnly, setUnmatchedOnly] = useState(false)
  const { isPrinted } = usePrintedDisputes()

  if (!creditData) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <p>No credit data available. Upload reports first.</p>
        <Link href="/upload" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Go to Upload Center</Link>
      </div>
    )
  }

  const allInquiries = creditData.reports.flatMap(r =>
    r.inquiries.map(i => ({ ...i, bureau: r.bureau as Bureau }))
  )

  const openAccountNames = creditData.reports.flatMap(r =>
    r.accounts.filter(a => a.isOpen).map(a => a.creditorName)
  )

  const hardInquiries = allInquiries.filter(i => i.type === 'Hard')
  const unmatchedHard = hardInquiries.filter(i => !isTiedToOpenAccount(i.creditorName, openAccountNames))
  const tiedToOpen = (name: string) => isTiedToOpenAccount(name, openAccountNames)
  const visibleInquiries = unmatchedOnly ? unmatchedHard : allInquiries

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Inquiry Tracker</h1>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setUnmatchedOnly(!unmatchedOnly)}>
          {unmatchedOnly ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
          {unmatchedOnly ? 'Show All' : `Unmatched Hard (${unmatchedHard.length})`}
        </Button>
      </div>

      {unmatchedOnly && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
              <Search className="w-4 h-4" />
              <span>
                Showing <strong>{unmatchedHard.length}</strong> hard inquiry{unmatchedHard.length !== 1 ? 'ies' : 'y'} not tied to an open account
                on your reports. These may warrant a <Link href="/dispute-letters" className="underline">dispute</Link>.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <p className="font-semibold text-amber-700 dark:text-amber-300 mb-1">Careful: Do not dispute Open Accounts</p>
              <p>
                Only dispute items that are <strong>inaccurate</strong>, <strong>not yours</strong>, or <strong>obsolete</strong>. Open accounts that you are
                actively using are <strong>helping your credit</strong> — disputing them can backfire. If a bureau can&apos;t verify an open account
                within 30 days, it may <strong>remove it from your report</strong>, which can <strong>lower your credit score</strong> by removing positive
                payment history, reducing your available credit, and raising your utilization ratio.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {visibleInquiries.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Search className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {unmatchedOnly ? 'Every hard inquiry is tied to an open account' : 'No inquiries found in uploaded reports'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Inquiry data is parsed from the inquiries section of each report</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <CardTitle className="mb-4">
              {unmatchedOnly ? 'Unmatched Hard Inquiries' : 'All Inquiries'}
              <Badge className="ml-2">{visibleInquiries.length} total</Badge>
            </CardTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Creditor</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Bureau</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Date</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Type</th>
                    <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInquiries.map((inq, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">{inq.creditorName}</td>
                      <td className="py-2 px-2">
                        <Badge>{inq.bureau}</Badge>
                      </td>
                      <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{inq.date}</td>
                      <td className="py-2 px-2">
                        <Badge variant={inq.type === 'Hard' ? 'warning' : 'default'}>{inq.type}</Badge>
                      </td>
                      <td className="py-2 px-2 text-right">
                        {inq.type === 'Hard' && !tiedToOpen(inq.creditorName) ? (
                          isPrinted(inq.creditorName, inq.bureau) ? (
                            <PrintedBadge />
                          ) : (
                            <Link
                              href={disputeLink(inq.bureau, inq.creditorName, 'inquiry')}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              <FilePen className="w-3.5 h-3.5" /> Dispute
                            </Link>
                          )
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
