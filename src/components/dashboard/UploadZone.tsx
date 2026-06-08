'use client'

import React from 'react'
import { FileText, Upload, AlertTriangle, CheckCircle, Trash2, RotateCcw } from 'lucide-react'
import { useCredit } from '@/lib/store/creditStore'
import { Button } from '@/components/ui/button'
import type { Bureau } from '@/types'

const bureauConfig: Record<Bureau, { color: string; bg: string; border: string; lightBg: string }> = {
  Experian: { color: 'text-blue-600', bg: 'bg-blue-500', border: 'border-blue-500', lightBg: 'bg-blue-50 dark:bg-blue-900/20' },
  Equifax: { color: 'text-emerald-600', bg: 'bg-emerald-500', border: 'border-emerald-500', lightBg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  TransUnion: { color: 'text-purple-600', bg: 'bg-purple-500', border: 'border-purple-500', lightBg: 'bg-purple-50 dark:bg-purple-900/20' },
}

export function UploadZone() {
  const { state, uploadFile, removeReport, clearAll } = useCredit()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragging(true)
    else setDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      await uploadFile(file)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      await uploadFile(file)
    }
    if (e.target) e.target.value = ''
  }

  return (
    <div>
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${dragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
          }
        `}
      >
        <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Drop credit report files here or click to browse
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Supports PDF (Experian, Equifax) and TXT (TransUnion) files
        </p>
        <input ref={fileInputRef} type="file" accept=".pdf,.txt" multiple className="hidden" onChange={handleFileSelect} />
      </div>

      {state.loading && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          Parsing report...
        </div>
      )}

      {state.error && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-2 text-sm text-yellow-700 dark:text-yellow-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {state.reports.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Uploaded Reports</p>
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset All
            </Button>
          </div>
          {state.reports.map(report => {
            const config = bureauConfig[report.bureau]
            return (
              <div key={report.bureau} className={`flex items-center gap-3 p-3 rounded-lg ${config.lightBg} border border-gray-200 dark:border-gray-700`}>
                <div className={`w-2 h-2 rounded-full ${config.bg}`} />
                <FileText className={`w-4 h-4 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {report.bureau}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {report.filename || 'Report'} &middot; {report.summary.totalAccounts} accounts
                  </p>
                </div>
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <button
                  onClick={() => removeReport(report.bureau)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title={`Remove ${report.bureau} report`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
