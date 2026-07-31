'use client'

import React from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { UploadZone } from '@/components/dashboard/UploadZone'
export default function UploadPage() {

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Upload Center</h1>
      </div>

      <Card>
        <CardContent className="p-6">
          <UploadZone />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Supported Formats</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="font-medium text-blue-700 dark:text-blue-300">Experian</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">PDF format</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <p className="font-medium text-emerald-700 dark:text-emerald-300">Equifax</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">PDF format</p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="font-medium text-purple-700 dark:text-purple-300">TransUnion</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">TXT format</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
            Important Note: Get Your Free Credit Reports
          </h3>
          <div className="text-xs text-amber-700 dark:text-amber-300 space-y-2 leading-relaxed">
            <p>
              <strong>AnnualCreditReport.com</strong> is the only federally authorized website
              for free credit reports. Since April 2023, you can visit once per week and get
              reports from all three bureaus (Equifax, Experian, and TransUnion) for free —
              no subscription or credit card needed.
            </p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Go to <a href="https://www.annualcreditreport.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">annualcreditreport.com</a></li>
              <li>Verify your identity (name, SSN, address, and security questions)</li>
              <li>Select all three bureaus: Equifax, Experian, and TransUnion</li>
              <li>Choose &quot;View PDF&quot; or &quot;Download PDF&quot; for each report</li>
              <li>Upload each PDF here on retteewealth.me</li>
            </ol>
            <p className="mt-2">
              Reports from AnnualCreditReport.com work best with our parsers because they use
              a consistent PDF format designed for automated processing. Other sources
              (Credit Karma, third-party apps, lender portals) often produce non-standard
              layouts that may not parse correctly.
            </p>
            <p className="mt-1">
              This is a <strong>free, government-authorized</strong> service — your data stays
              between you and the credit bureaus. We only process the information you upload
              and never share it.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
