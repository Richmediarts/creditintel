'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, Download, Trash2, Copy, Check, FileText } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { letterTextToDocx } from '@/lib/utils/disputeLetters'

interface LetterDetail {
  id: number
  creditorName: string
  bureau: string
  letterType: string
  letterText: string
  createdAt: string
}

const LETTER_TYPE_LABELS: Record<string, string> = {
  dispute: 'CRA Dispute & Deletion Demand',
  revocation: 'Revocation of Authorization',
  validation: 'Validation Request',
  inquiry: 'Inquiry Dispute (Unauthorized Hard Inquiry)',
}

export default function LetterDetailPage() {
  const { user, loading: authLoading } = useAuth()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [letter, setLetter] = useState<LetterDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (!user || !params.id) return
    fetch(`/api/letters/${params.id}`).then(res => {
      if (!res.ok) return
      return res.json()
    }).then(data => {
      if (data?.letter) setLetter(data.letter)
      setLoading(false)
    })
  }, [user, authLoading, params.id])

  const handleDelete = async () => {
    if (!letter || !confirm('Delete this saved letter?')) return
    const res = await fetch(`/api/letters/${letter.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/letters')
  }

  const handleCopy = async () => {
    if (!letter) return
    await navigator.clipboard.writeText(letter.letterText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!letter) return
    const filename = `${letter.letterType}_${letter.bureau}_${letter.creditorName.replace(/[^a-z0-9]/gi, '_')}`
    const url = URL.createObjectURL(new Blob([letter.letterText], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadDocx = async () => {
    if (!letter) return
    const filename = `${letter.letterType}_${letter.bureau}_${letter.creditorName.replace(/[^a-z0-9]/gi, '_')}`
    const blob = await letterTextToDocx(letter.letterText)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (authLoading) return <div className="text-center py-20 text-gray-500">Loading...</div>
  if (!user) return null

  if (loading) return <div className="text-center py-20 text-gray-500">Loading...</div>
  if (!letter) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <p>Letter not found.</p>
        <Link href="/letters" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Back to Library</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/letters" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{letter.creditorName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1" /> .txt
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownloadDocx}>
            <Download className="w-4 h-4 mr-1" /> .docx
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Badge>{letter.bureau}</Badge>
            <Badge variant="info">{LETTER_TYPE_LABELS[letter.letterType] || letter.letterType}</Badge>
            <span className="text-xs text-gray-400">
              Saved {new Date(letter.createdAt).toLocaleString()}
            </span>
          </div>
          <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-[70vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            {letter.letterText}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
