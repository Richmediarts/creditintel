'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Mail, Lock, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

export default function SettingsPage() {
  const { user, loading: authLoading, logout } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) setEmail(user.email)
  }, [user, authLoading, router])

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage('Email updated')
    } else {
      setError(data.error || 'Failed to update email')
    }
    setSaving(false)
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }
    setSaving(true)

    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage('Password updated')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      setError(data.error || 'Failed to update password')
    }
    setSaving(false)
  }

  if (authLoading) return <div className="text-center py-20 text-gray-500">Loading...</div>
  if (!user) return null

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
      </div>

      {message && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {message}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Profile Info */}
      <Card>
        <CardContent className="p-4">
          <CardTitle className="mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> Profile
          </CardTitle>
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <p><span className="text-gray-500">Name:</span> {user.name}</p>
            <p><span className="text-gray-500">Role:</span> {user.role}</p>
            <p><span className="text-gray-500">Email:</span> {user.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Change Email */}
      <Card>
        <CardContent className="p-4">
          <CardTitle className="mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4" /> Change Email
          </CardTitle>
          <form onSubmit={handleUpdateEmail} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              required
            />
            <Button type="submit" disabled={saving || email === user.email} size="sm">
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardContent className="p-4">
          <CardTitle className="mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4" /> Change Password
          </CardTitle>
          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              required
            />
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password (min 6 characters)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              required
              minLength={6}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              required
            />
            <Button type="submit" disabled={saving} size="sm">
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
