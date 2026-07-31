'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wallet, PlusCircle, Edit, Trash2, DollarSign, PieChart, Tag,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

interface Category {
  id: number
  name: string
  monthly_limit: number | null
  color: string | null
  parent_id: number | null
  parent_name?: string | null
  children?: Category[]
}

const fmt = (n: unknown): string =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const EMPTY_FORM = { name: '', monthly_limit: '', color: '#3b82f6', parent_id: '' }

export default function CategoriesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const fetchCategories = useCallback(async () => {
    const res = await fetch('/api/budget/categories?flat=true')
    if (res.ok) {
      const data = await res.json()
      setCategories(data.categories)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchCategories()
  }, [user, authLoading, fetchCategories])

  const setField = (name: string, v: string) => setForm((f) => ({ ...f, [name]: v }))

  const startAdd = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startEdit = (cat: Category) => {
    setEditing(cat)
    setForm({
      name: cat.name,
      monthly_limit: cat.monthly_limit != null ? String(cat.monthly_limit) : '',
      color: cat.color || '#3b82f6',
      parent_id: cat.parent_id != null ? String(cat.parent_id) : '',
    })
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Category name is required'); return }
    setError('')
    setMessage('')
    setSaving(true)

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      monthly_limit: form.monthly_limit ? Number(form.monthly_limit) : null,
      color: form.color || null,
      parent_id: form.parent_id ? Number(form.parent_id) : null,
    }

    const url = editing ? `/api/budget/categories/${editing.id}` : '/api/budget/categories'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(editing ? 'Category updated' : 'Category added')
      setEditing(null)
      setForm({ ...EMPTY_FORM })
      await fetchCategories()
    } else {
      setError(data.error || 'Failed to save category')
    }
    setSaving(false)
  }

  const handleDelete = async (cat: Category) => {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return
    const res = await fetch(`/api/budget/categories/${cat.id}`, { method: 'DELETE' })
    if (res.ok) {
      setMessage('Category deleted')
      await fetchCategories()
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to delete category')
    }
  }

  const parentCategories = categories.filter((c) => c.parent_id == null)
  const getChildren = (parentId: number) => categories.filter((c) => c.parent_id === parentId)

  const totalMonthly = parentCategories.reduce((sum, c) => sum + (Number(c.monthly_limit) || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Budget Categories</h1>
          <p className="text-sm text-gray-500">Organize and manage spending categories with monthly limits.</p>
        </div>
        {!editing && (
          <Button onClick={startAdd}><PlusCircle className="w-4 h-4 mr-2" /> Add Category</Button>
        )}
      </div>

      {message && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <PieChart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Monthly Budget</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{fmt(totalMonthly)}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-gray-500 dark:text-gray-400">{parentCategories.length} Categories</p>
              <p className="text-xs text-gray-400">{categories.length} Total (incl. subcategories)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {(editing || !loading) && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-sm">
                {editing ? `Edit Category — ${editing.name}` : 'Add Category'}
              </CardTitle>
              {editing && (
                <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setForm({ ...EMPTY_FORM }) }}>
                  Cancel
                </Button>
              )}
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="e.g. Groceries"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Monthly Limit</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.monthly_limit}
                    onChange={(e) => setField('monthly_limit', e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setField('color', e.target.value)}
                      className="w-10 h-10 rounded border border-gray-200 dark:border-gray-700 cursor-pointer"
                    />
                    <span className="text-xs text-gray-400">{form.color}</span>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Parent Category</label>
                  <select
                    value={form.parent_id}
                    onChange={(e) => setField('parent_id', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None (top-level)</option>
                    {parentCategories.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <Button type="submit" disabled={saving}>
                  <Tag className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Category'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5">
          <CardTitle className="text-sm mb-3">All Categories</CardTitle>
          {loading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : categories.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No categories yet.</p>
              <Button onClick={startAdd} className="mt-3"><PlusCircle className="w-4 h-4 mr-2" /> Add your first category</Button>
            </div>
          ) : (
            <div className="space-y-1">
              {parentCategories.map((cat) => {
                const children = getChildren(cat.id)
                return (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color || '#9ca3af' }}
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{cat.name}</span>
                          {cat.parent_name && (
                            <span className="text-xs text-gray-400 ml-2">in {cat.parent_name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          <DollarSign className="w-3.5 h-3.5 inline" />{cat.monthly_limit != null ? Number(cat.monthly_limit).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                        </span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(cat)} className="text-amber-600 dark:text-amber-400 hover:text-amber-700">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(cat)} className="text-red-500 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {children.map((child) => (
                      <div key={child.id} className="flex items-center justify-between py-2 pl-10 pr-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: child.color || '#9ca3af' }}
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{child.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            <DollarSign className="w-3 h-3 inline" />{child.monthly_limit != null ? Number(child.monthly_limit).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                          </span>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(child)} className="text-amber-600 dark:text-amber-400 hover:text-amber-700">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(child)} className="text-red-500 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
