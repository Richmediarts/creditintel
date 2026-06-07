'use client'

import React from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCredit } from '@/lib/store/creditStore'

export default function InquiriesPage() {
  const { state } = useCredit()
  const { creditData } = state

  if (!creditData) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <p>No credit data available. Upload reports first.</p>
        <Link href="/upload" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Go to Upload Center</Link>
      </div>
    )
  }

  const allInquiries = creditData.reports.flatMap(r =>
    r.inquiries.map(i => ({ ...i, bureau: r.bureau }))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Inquiry Tracker</h1>
      </div>

      {allInquiries.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Search className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No inquiries found in uploaded reports</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Inquiry data is parsed from the inquiries section of each report</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <CardTitle className="mb-4">
              All Inquiries
              <Badge className="ml-2">{allInquiries.length} total</Badge>
            </CardTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Creditor</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Bureau</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Date</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {allInquiries.map((inq, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">{inq.creditorName}</td>
                      <td className="py-2 px-2">
                        <Badge>{inq.bureau}</Badge>
                      </td>
                      <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{inq.date}</td>
                      <td className="py-2 px-2">
                        <Badge variant={inq.type === 'Hard' ? 'warning' : 'default'}>{inq.type}</Badge>
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
