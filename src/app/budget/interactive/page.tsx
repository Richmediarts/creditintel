'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Minus, DollarSign, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'

interface Category {
  id: number
  name: string
  monthly_limit: number
  color: string
  parent_id?: number
  actual_spent: number
}

interface Bill {
  id: number
  payee_name?: string
  amount: number
  category_id?: number
  is_paid: number
}

interface Stats {
  biweekly_income: number
  last_paycheck_net: number
  monthly_expenses: number
}

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function progressColor(pct: number): string {
  if (pct > 90) return 'bg-red-500'
  if (pct >= 75) return 'bg-yellow-400'
  return 'bg-emerald-500'
}

function progressTextColor(pct: number): string {
  if (pct > 90) return 'text-red-600 dark:text-red-400'
  if (pct >= 75) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

export default function InteractiveBudgetPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    const [statsRes, catsRes, billsRes] = await Promise.all([
      fetch('/api/budget/stats'),
      fetch('/api/budget/categories?flat=true'),
      fetch('/api/budget/bills'),
    ])
    if (statsRes.ok) {
      const d = await statsRes.json()
      setStats(d.stats)
    }
    if (catsRes.ok) {
      const d = await catsRes.json()
      setCategories(d.categories)
    }
    if (billsRes.ok) {
      const d = await billsRes.json()
      setBills(d.bills)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchData()
  }, [user, authLoading, fetchData])

  const adjustSpent = useCallback(async (cat: Category, delta: number) => {
    const newSpent = Math.max(0, cat.actual_spent + delta)
    setUpdatingId(cat.id)
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, actual_spent: newSpent } : c))
    )
    await fetch(`/api/budget/categories/${cat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual_spent: newSpent }),
    })
    setUpdatingId(null)
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  const billsByCategory: Record<number, Bill[]> = {}
  const uncategorized: Bill[] = []
  for (const bill of bills) {
    if (bill.category_id) {
      if (!billsByCategory[bill.category_id]) billsByCategory[bill.category_id] = []
      billsByCategory[bill.category_id].push(bill)
    } else {
      uncategorized.push(bill)
    }
  }

  const totalBudget = categories.reduce((s, c) => s + c.monthly_limit, 0)
  const totalSpent = categories.reduce((s, c) => s + c.actual_spent, 0)
  const biweeklyIncome = stats?.biweekly_income || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Interactive Budget</h1>
        <p className="text-sm text-gray-500">Track spending against your budget categories in real time.</p>
      </div>

      {/* Biweekly Income */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Biweekly Income</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(biweeklyIncome)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Monthly Budget</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{fmt(totalBudget)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-400">Total Budget</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{fmt(totalBudget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-400">Total Spent</p>
            <p className={`text-lg font-bold ${totalSpent > totalBudget ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{fmt(totalSpent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-400">Remaining</p>
            <p className={`text-lg font-bold ${(totalBudget - totalSpent) < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmt(totalBudget - totalSpent)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Categories with progress bars */}
      <Card>
        <CardContent className="p-5">
          <CardTitle className="text-sm mb-4">Budget Categories</CardTitle>
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400">No budget categories yet.</p>
          ) : (
            <div className="space-y-4">
              {categories.map((cat) => {
                const pct = cat.monthly_limit > 0 ? Math.min((cat.actual_spent / cat.monthly_limit) * 100, 100) : 0
                const barWidth = cat.monthly_limit > 0 ? Math.min((cat.actual_spent / cat.monthly_limit) * 100, 100) : 0
                const catBills = billsByCategory[cat.id] || []

                return (
                  <div key={cat.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${progressTextColor(pct)}`}>
                          {fmt(cat.actual_spent)} / {fmt(cat.monthly_limit)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => adjustSpent(cat, -10)}
                            disabled={updatingId === cat.id}
                            className="w-7 h-7 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors disabled:opacity-50"
                          >
                            <Minus className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                          </button>
                          <button
                            onClick={() => adjustSpent(cat, 10)}
                            disabled={updatingId === cat.id}
                            className="w-7 h-7 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${progressColor(pct)}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-right">{Math.round(pct)}%</p>

                    {/* Bills under this category */}
                    {catBills.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-1">
                        {catBills.map((bill) => (
                          <div key={bill.id} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                              {bill.is_paid ? (
                                <CheckCircle className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <DollarSign className="w-3 h-3 text-gray-400" />
                              )}
                              {bill.payee_name || 'Unknown'}
                            </span>
                            <span className={`font-medium ${bill.is_paid ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                              {fmt(bill.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uncategorized bills */}
      {uncategorized.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <CardTitle className="text-sm mb-3">Uncategorized Bills</CardTitle>
            <div className="space-y-1">
              {uncategorized.map((bill) => (
                <div key={bill.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    {bill.is_paid ? (
                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <DollarSign className="w-3 h-3 text-gray-400" />
                    )}
                    {bill.payee_name || 'Unknown'}
                  </span>
                  <span className={`font-medium ${bill.is_paid ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                    {fmt(bill.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
