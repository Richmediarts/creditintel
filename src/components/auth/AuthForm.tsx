'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function AuthForm({ initialMode }: { initialMode: 'signin' | 'signup' }) {
  const router = useRouter()
  const { user, loading: authLoading, login } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (user) { router.push('/'); return }
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    if (mode === 'signup') {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (res.ok) {
        await login(email, password)
        router.push('/getting-started')
        return
      }
      setError(data.error || 'Registration failed')
      setSubmitting(false)
      return
    }
    const err = await login(email, password)
    if (err) {
      setError(err)
      setSubmitting(false)
    }
  }

  if (authLoading) return null
  if (user) return null

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {mode === 'signup' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-base text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Your name"
            required
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-base text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="you@example.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-base text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
          required
        />
      </div>

      {mode === 'signin' && (
        <>
          <div className="flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="py-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              Forgot password?
            </Link>
            <span className="text-gray-400 dark:text-gray-500">
              Forgot email? Ask your admin
            </span>
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <strong>Try the demo:</strong> sign in with <strong>example@retteewealth.me</strong> / <strong>example123</strong> to explore the score simulator and budget pages (read-only, mirrors the admin data). Editing, deleting, and account settings are locked.
            </p>
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-base font-medium rounded-lg transition-colors"
      >
        {submitting ? (mode === 'signup' ? 'Creating account...' : 'Signing in...') : mode === 'signup' ? 'Create Account' : 'Sign In'}
      </button>

      <div className="text-center text-sm pt-1">
        {mode === 'signin' ? (
          <p className="text-gray-500 dark:text-gray-400">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              Sign up
            </Link>
          </p>
        ) : (
          <>
            <p className="text-gray-500 dark:text-gray-400">
              Already have an account?{' '}
              <Link
                href="/login"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                Sign in
              </Link>
            </p>
            <div className="mt-5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-left">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">New here? Here&apos;s how to get started</p>
              <ol className="list-decimal pl-4 text-xs text-blue-700 dark:text-blue-300 space-y-1 leading-relaxed">
                <li>Create your account, then use the <strong>Getting Started</strong> guide to set everything up.</li>
                <li>Upload your credit reports (free at annualcreditreport.com) to unlock the credit tools.</li>
                <li>Add your bank accounts, credit cards, bills, and categories—manually or via the spreadsheet template.</li>
                <li>Add paychecks so the budget knows your income and pay periods.</li>
              </ol>
            </div>
          </>
        )}
      </div>
    </form>
  )
}