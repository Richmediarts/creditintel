'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plug, ArrowRight, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

export default function PlaidSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [clientId, setClientId] = useState('')
  const [secret, setSecret] = useState('')
  const [environment, setEnvironment] = useState('sandbox')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  const fetchSettings = useCallback(async () => {
    const res = await fetch('/api/budget/plaid/settings')
    if (res.ok) {
      const data = await res.json()
      setClientId(data.client_id || '')
      setEnvironment(data.environment || 'sandbox')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (user) fetchSettings()
  }, [user, fetchSettings])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)
    const res = await fetch('/api/budget/plaid/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, environment }),
    })
    if (res.ok) {
      setSuccess(true)
      setSecret('')
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Plug className="h-7 w-7 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Plaid API Settings</h1>
      </div>

      <Link
        href="/budget/bank-accounts"
        className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
      >
        <ArrowRight className="h-3 w-3 rotate-180" /> Back to Bank Accounts
      </Link>

      {/* Instructions */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <CardTitle className="mb-3">Setup Instructions</CardTitle>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <li>Go to <a href="https://dashboard.plaid.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">dashboard.plaid.com</a> and sign up or log in</li>
            <li>Get your <strong>client_id</strong> and <strong>secret</strong> from the Keys section</li>
            <li>Use <strong>sandbox</strong> for testing, <strong>development</strong> for live data</li>
          </ol>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-5">
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Client ID</label>
                <input
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your Plaid client ID"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Secret</label>
                <input
                  type="password"
                  required
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your Plaid secret"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Environment</label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sandbox">Sandbox (Testing)</option>
                  <option value="development">Development (Live Data)</option>
                  <option value="production">Production</option>
                </select>
              </div>

              {success && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                  <CheckCircle className="h-4 w-4" />
                  Settings saved successfully.
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
                <Link href="/budget/bank-accounts">
                  <Button type="button" variant="secondary">Cancel</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
