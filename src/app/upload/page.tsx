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
        <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
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
    </div>
  )
}
