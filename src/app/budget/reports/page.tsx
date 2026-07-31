'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, ArrowLeft, CalendarDays } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

interface BudgetBill {
  id: number
  payee_name?: string
  amount: number
  due_date: string
}

interface PeriodData {
  income: number
  expenses: number
  bills: BudgetBill[]
}

interface PayPeriodHistory {
  periods: Record<string, PeriodData>
}

const fmt = (n: unknown): string =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PayPeriodReportsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<PayPeriodHistory | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/budget/pay-period-history')
    if (res.ok) {
      const json = await res.json()
      setData(json)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchData()
  }, [user, authLoading, fetchData])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  const periods = data?.periods || {}
  const keys = Object.keys(periods)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Pay Period Reports
          </h1>
          <p className="text-sm text-gray-500">Income vs. expenses breakdown for each pay period.</p>
        </div>
        <Link href="/budget">
          <Button variant="secondary" size="sm"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard</Button>
        </Link>
      </div>

      {keys.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarDays className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No pay period data available. Import paychecks to see reports.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <CardTitle className="text-sm">Pay Period Summary</CardTitle>
              <Badge variant="info">{keys.length} Periods</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-3">Pay Period</th>
                    <th className="py-2 pr-3 text-right">Income (Net)</th>
                    <th className="py-2 pr-3 text-right">Bills Paid</th>
                    <th className="py-2 text-right">Net Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => {
                    const p = periods[key]
                    const net = p.income - p.expenses
                    return (
                      <tr key={key} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">{key}</td>
                        <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{fmt(p.income)}</td>
                        <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{fmt(p.expenses)}</td>
                        <td className={`py-2 text-right font-semibold ${net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                          {net >= 0 ? '+' : ''}{fmt(net)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
