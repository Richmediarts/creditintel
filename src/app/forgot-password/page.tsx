'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { FileText, ArrowLeft, CheckCircle2, AlertCircle, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ message: string; resetUrl?: string } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.resetUrl) {
        setResult({ message: data.message, resetUrl: data.resetUrl })
      } else {
        setResult({ message: data.error || 'If that email exists, a reset link has been generated' })
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (result?.resetUrl) {
      await navigator.clipboard.writeText(result.resetUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1 mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Reset Password</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Enter your email to get a password reset link
            </p>
          </div>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-green-700 dark:text-green-400">{result.message}</p>
                {result.resetUrl && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-green-600 dark:text-green-500">
                      Since there's no email server configured, copy this link to share with the user:
                    </p>
                    <div className="flex gap-2">
                      <code className="flex-1 p-2 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 rounded text-xs break-all">
                        {result.resetUrl}
                      </code>
                      <Button variant="secondary" size="sm" onClick={handleCopy}>
                        {copied ? 'Copied' : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">Link expires in 1 hour</p>
                  </div>
                )}
              </div>
            </div>
            <Link href="/login" className="block text-center text-sm text-blue-600 hover:underline">
              Return to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full justify-center">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
