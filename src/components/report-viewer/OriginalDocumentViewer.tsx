'use client'

import React, { useState } from 'react'
import { X, FileText, File, ChevronDown, ChevronUp } from 'lucide-react'
import type { BureauReport } from '@/types'

const bureauAccent: Record<string, { border: string; bg: string; text: string }> = {
  Experian: { border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
  Equifax: { border: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' },
  TransUnion: { border: 'border-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' },
}

export function OriginalDocumentViewer({ report }: { report: BureauReport }) {
  const [expanded, setExpanded] = useState(false)
  const accent = bureauAccent[report.bureau] || bureauAccent['Experian']

  return (
    <div className={`rounded-lg border ${accent.border} ${accent.bg} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:opacity-80 transition-opacity"
      >
        <File className={`w-5 h-5 ${accent.text}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            Original {report.bureau} Report
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {report.filename || 'Uploaded file'} &middot; {report.fileType?.toUpperCase() || 'DOCUMENT'}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {report.fileType === 'pdf' && report.fileData ? (
            <embed
              src={`data:application/pdf;base64,${report.fileData}`}
              type="application/pdf"
              className="w-full h-[600px] md:h-[800px] rounded-b-lg"
            />
          ) : report.fileData ? (
            <pre className="p-4 text-xs leading-relaxed text-gray-700 dark:text-gray-300 overflow-auto max-h-[600px] md:max-h-[800px] font-mono whitespace-pre-wrap">
              {atob(report.fileData)}
            </pre>
          ) : report.rawText ? (
            <pre className="p-4 text-xs leading-relaxed text-gray-700 dark:text-gray-300 overflow-auto max-h-[600px] md:max-h-[800px] font-mono whitespace-pre-wrap">
              {report.rawText}
            </pre>
          ) : (
            <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
              Original document not available.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
