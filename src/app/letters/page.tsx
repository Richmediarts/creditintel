'use client'

import React, { useState, useEffect } from 'react'
import {
  ArrowLeft, Folder, FolderOpen, FileText, Download, Trash2,
  Copy, Check, Loader2, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { letterTextToDocx } from '@/lib/utils/disputeLetters'
import type { Bureau } from '@/types'

interface Letter {
  id: number
  creditorName: string
  bureau: string
  letterType: string
  createdAt: string
}

const LETTER_TYPE_LABELS: Record<string, string> = {
  dispute: 'CRA Dispute & Deletion Demand',
  revocation: 'Revocation of Authorization',
  validation: 'Validation Request',
  inquiry: 'Inquiry Dispute (Unauthorized Hard Inquiry)',
}

const LETTER_TYPE_ICONS: Record<string, string> = {
  dispute: 'red',
  revocation: 'amber',
  validation: 'purple',
  inquiry: 'blue',
}

const BUREAUS: Bureau[] = ['Experian', 'Equifax', 'TransUnion']

function letterTypeBadgeClass(type: string): string {
  const color = LETTER_TYPE_ICONS[type] || 'gray'
  const map: Record<string, string> = {
    red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800',
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
    gray: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  }
  return map[color] || map.gray
}

const downloadText = (text: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const downloadDocx = async (text: string, filename: string) => {
  const blob = await letterTextToDocx(text)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function LettersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [letters, setLetters] = useState<Letter[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const fetchLetters = async () => {
    const res = await fetch('/api/letters')
    if (res.ok) {
      const data = await res.json()
      setLetters(data.letters)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchLetters()
  }, [user, authLoading])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this saved letter?')) return
    const res = await fetch(`/api/letters/${id}`, { method: 'DELETE' })
    if (res.ok) fetchLetters()
  }

  const handleDownloadLetter = async (id: number) => {
    const res = await fetch(`/api/letters/${id}`)
    if (!res.ok) return
    const data = await res.json()
    const letter = data.letter
    const filename = `${letter.letterType}_${letter.bureau}_${letter.creditorName.replace(/[^a-z0-9]/gi, '_')}.txt`
    downloadText(letter.letterText, filename)
  }

  const handleCopy = async (id: number, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (authLoading) return <div className="text-center py-20 text-gray-500">Loading...</div>
  if (!user) return null

  const groups: Record<string, Record<string, Letter[]>> = {}
  for (const bureau of BUREAUS) groups[bureau] = {}
  for (const letter of letters) {
    if (!groups[letter.bureau]) groups[letter.bureau] = {}
    if (!groups[letter.bureau][letter.letterType]) groups[letter.bureau][letter.letterType] = []
    groups[letter.bureau][letter.letterType].push(letter)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Letters Library</h1>
        <Badge variant="info">{letters.length} saved</Badge>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Every letter saved from the Dispute Letter Generator is stored here, organized into folders by Credit Bureau and letter type.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading letters...
        </div>
      ) : letters.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Folder className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No saved letters yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Download a letter from the <Link href="/dispute-letters" className="text-blue-600 dark:text-blue-400 underline">Dispute Letter Generator</Link> and it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {BUREAUS.map(bureau => {
            const typeGroups = groups[bureau]
            const total = Object.values(typeGroups).reduce((sum, list) => sum + list.length, 0)
            const hasLetters = total > 0
            return (
              <Card key={bureau} className={hasLetters ? 'border-t-4 border-t-blue-500' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {hasLetters ? <FolderOpen className="w-5 h-5 text-blue-500" /> : <Folder className="w-5 h-5 text-gray-300 dark:text-gray-600" />}
                      <span className="font-semibold text-gray-900 dark:text-white">{bureau}</span>
                    </div>
                    <Badge variant={hasLetters ? 'info' : 'default'}>{total}</Badge>
                  </div>

                  {Object.entries(typeGroups).map(([type, list]) => (
                    <div key={type} className="mb-2">
                      <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 mb-1">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{LETTER_TYPE_LABELS[type] || type}</span>
                        <span className="text-[11px] text-gray-400">{list.length}</span>
                      </div>
                      {list.map(letter => (
                        <div key={letter.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-lg group">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{letter.creditorName}</p>
                              <p className="text-[11px] text-gray-400">{new Date(letter.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link
                              href={`/letters/${letter.id}`}
                              title="Open letter"
                              className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleDownloadLetter(letter.id)}
                              title="Download .txt"
                              className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(letter.id)}
                              title="Delete"
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {list.length === 0 && (
                        <p className="px-2 py-1 text-xs text-gray-300 dark:text-gray-600">No letters</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
