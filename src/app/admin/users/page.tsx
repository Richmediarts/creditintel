'use client'

import React, { useState, useEffect } from 'react'
import { UserPlus, Trash2, ShieldOff, KeyRound } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import type { User } from '@/types'

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [changingPw, setChangingPw] = useState<number | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwUpdating, setPwUpdating] = useState(false)

  const fetchUsers = async () => {
    const res = await fetch('/api/users')
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users)
    }
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setAdding(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to add user')
    } else {
      setName('')
      setEmail('')
      setPassword('')
      setRole('member')
      setShowAdd(false)
      fetchUsers()
    }
    setAdding(false)
  }

  const handleDelete = async (userId: number) => {
    if (!confirm('Delete this user and all their disputes?')) return
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
    if (res.ok) fetchUsers()
  }

  const handleChangePassword = async (userId: number) => {
    setPwError('')
    if (!newPassword || newPassword.length < 6) {
      setPwError('Password must be at least 6 characters')
      return
    }
    setPwUpdating(true)
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })
    const data = await res.json()
    if (!res.ok) {
      setPwError(data.error || 'Failed to update password')
    } else {
      setChangingPw(null)
      setNewPassword('')
    }
    setPwUpdating(false)
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <ShieldOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Admin access required</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">User Management</h1>
        <Button onClick={() => setShowAdd(!showAdd)}>
          <UserPlus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleAdd} className="space-y-3">
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Name" required
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                />
                <input
                  value={email} onChange={e => setEmail(e.target.value)}
                  type="email" placeholder="Email" required
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={password} onChange={e => setPassword(e.target.value)}
                  type="password" placeholder="Password" required
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                />
                <select
                  value={role} onChange={e => setRole(e.target.value as 'member' | 'admin')}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button type="submit" disabled={adding}>{adding ? 'Adding...' : 'Add User'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-gray-500 p-4">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-500 p-4">No users yet</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {users.map(u => (
                <div key={u.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{u.name[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                      <Badge variant={u.role === 'admin' ? 'info' : 'default'}>{u.role}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setChangingPw(changingPw === u.id ? null : u.id)
                          setNewPassword('')
                          setPwError('')
                        }}
                        className="text-gray-400 hover:text-blue-500 transition-colors"
                        title="Change password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      {u.id !== currentUser.id && (
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {changingPw === u.id && (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="New password"
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <button
                        onClick={() => handleChangePassword(u.id)}
                        disabled={pwUpdating}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                      >
                        {pwUpdating ? 'Saving...' : 'Save'}
                      </button>
                      {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
