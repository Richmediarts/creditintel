'use client'

import React, { useState, useEffect } from 'react'
import { UserPlus, Trash2, ShieldOff, Edit2, X, Check, Lock } from 'lucide-react'
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
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<'member' | 'admin'>('member')
  const [editAddress, setEditAddress] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

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

  const startEdit = (u: User) => {
    setEditingId(u.id)
    setEditName(u.name)
    setEditEmail(u.email)
    setEditRole(u.role)
    setEditAddress(u.address || '')
    setEditPassword('')
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditPassword('')
    setEditError('')
  }

  const handleSaveEdit = async (userId: number) => {
    setEditError('')
    if (!editName.trim()) { setEditError('Name is required'); return }
    if (!editEmail.trim()) { setEditError('Email is required'); return }
    setEditSaving(true)
    const body: Record<string, string> = { name: editName.trim(), email: editEmail.trim(), role: editRole, address: editAddress.trim() }
    if (editPassword) body.password = editPassword
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      setEditError(data.error || 'Failed to update user')
    } else {
      setEditingId(null)
      fetchUsers()
    }
    setEditSaving(false)
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
                  {editingId === u.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Editing: {u.name}</p>
                        <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {editError && <p className="text-xs text-red-500">{editError}</p>}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Name</label>
                          <input
                            value={editName} onChange={e => setEditName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Email</label>
                          <input
                            value={editEmail} onChange={e => setEditEmail(e.target.value)}
                            type="email"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Role</label>
                          <select
                            value={editRole} onChange={e => setEditRole(e.target.value as 'member' | 'admin')}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                          {u.id === currentUser.id && editRole === 'member' && (
                            <p className="text-[10px] text-amber-500 mt-0.5">You cannot demote yourself if you are the last admin</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">New Password (leave blank to keep)</label>
                          <input
                            value={editPassword} onChange={e => setEditPassword(e.target.value)}
                            type="password" placeholder="Leave blank to keep current"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Address</label>
                        <textarea
                          value={editAddress} onChange={e => setEditAddress(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={cancelEdit}>Cancel</Button>
                        <Button type="button" size="sm" onClick={() => handleSaveEdit(u.id)} disabled={editSaving}>
                          <Check className="w-3 h-3 mr-1" /> {editSaving ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{u.name[0]}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                            {u.address && <p className="text-[10px] text-gray-400 mt-0.5">{u.address}</p>}
                          </div>
                          <Badge variant={u.role === 'admin' ? 'info' : 'default'}>{u.role}</Badge>
                          {(u as { is_example?: number }).is_example ? (
                            <Badge variant="info" className="!bg-amber-100 !text-amber-700 dark:!bg-amber-900/40 dark:!text-amber-300">
                              <Lock className="w-3 h-3 mr-1" /> Example
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {(u as { is_example?: number }).is_example ? (
                            <span className="text-[10px] text-gray-400" title="This example account is locked and cannot be edited or deleted">
                              Locked
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(u)}
                                className="text-gray-400 hover:text-blue-500 transition-colors"
                                title="Edit user"
                              >
                                <Edit2 className="w-4 h-4" />
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
                            </>
                          )}
                        </div>
                      </div>
                    </>
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
