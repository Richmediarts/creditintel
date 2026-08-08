'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet, CreditCard, TrendingUp, CalendarCheck, CalendarDays,
  Receipt, PiggyBank, PlusCircle, ArrowRight, Banknote,
  Landmark, WalletCards, CircleDollarSign,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

interface Bill {
  id: number
  payee_name?: string
  amount: number
  due_date: string
}

interface LastPaycheck {
  id: number
  pay_date?: string
  gross_pay?: number
  net_pay?: number
  check_date?: string
}

interface Stats {
  total_bank: number
  total_credit: number
  total_income: number
  total_income_accounts: number
  last_paycheck_net: number
  total_expenses: number
  total_expenses_paid: number
  bills_before_next_pay: Bill[]
  bills_before_next_pay_total: number
  next_paycheck_date: string | null
  upcoming_bills: Bill[]
  last_paycheck: LastPaycheck | null
  last_paycheck_date: string | null
  current_period_income: LastPaycheck | null
  biweekly_income: number
  biweekly_expenses: number
  biweekly_remaining: number
  monthly_income: number
  monthly_expenses: number
  monthly_expenses_paid: number
  monthly_expenses_due: number
  monthly_remaining: number
}

const fmt = (n: number): string =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

function dueBadge(dueDate: string) {
  const d = daysUntil(dueDate)
  if (d < 0) return { text: `Overdue ${-d}d`, cls: 'bg-red-600 text-white' }
  if (d === 0) return { text: 'Due Today', cls: 'bg-amber-500 text-black' }
  if (d <= 7) return { text: `${d} days`, cls: 'bg-amber-500 text-black' }
  return { text: `${d} days`, cls: 'bg-gray-600 text-white' }
}

function StatCard({
  title, amount, icon: Icon, accent, sub, href, negative,
}: {
  title: string
  amount: string
  icon: React.ElementType
  accent: string
  sub?: string
  href?: string
  negative?: boolean
}) {
  const body = (
    <Card className={`h-full ${href ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className={`text-xl sm:text-2xl font-bold mt-1 truncate ${negative ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{amount}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="w-5 h-5" />
        </div>
      </CardContent>
    </Card>
  )
  if (href) return <Link href={href} className="block h-full">{body}</Link>
  return body
}

export default function BudgetDashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/budget/stats')
    if (res.ok) {
      const data = await res.json()
      setStats(data.stats)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchStats()
  }, [user, authLoading, fetchStats])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Budget data unavailable</h1>
        <p className="text-sm text-gray-500 mb-4">No budget data found for your account yet.</p>
        <Link href="/budget/paychecks">
          <Button>Add your first paycheck</Button>
        </Link>
      </div>
    )
  }

  const netPosition = stats.total_bank - stats.total_credit

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Budget Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back, {user?.name} — here&apos;s your financial snapshot.</p>
        </div>
        <Link href="/budget/paychecks">
          <Button><PlusCircle className="w-4 h-4 mr-2" /> Add Paycheck</Button>
        </Link>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Bank Balance" amount={fmt(stats.total_bank)} icon={Wallet} accent="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" href="/budget/bank-accounts" />
        <StatCard title="Credit Card Debt" amount={fmt(stats.total_credit)} icon={CreditCard} accent="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" href="/budget/credit-cards" />
        <StatCard title="Net Position" amount={fmt(netPosition)} icon={TrendingUp} accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" negative={netPosition < 0} sub="Bank balance minus card debt" />
        <StatCard title="Last Paycheck Net" amount={fmt(stats.last_paycheck_net)} icon={Banknote} accent="bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400" sub={stats.last_paycheck_date ? `Paid ${stats.last_paycheck_date}` : undefined} href="/budget/paychecks" />
      </div>

      {/* Biweekly */}
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          <CalendarCheck className="w-4 h-4" /> Biweekly
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Income" amount={fmt(stats.biweekly_income)} icon={Wallet} accent="bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400" sub="Last paycheck net" />
          <StatCard title="Expenses" amount={fmt(stats.biweekly_expenses)} icon={Receipt} accent="bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400" sub="Bills due this pay period" />
          <StatCard title="Remaining" amount={fmt(stats.biweekly_remaining)} icon={PiggyBank} accent="bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400" negative={stats.biweekly_remaining < 0} sub={stats.next_paycheck_date ? `Next paycheck: ${stats.next_paycheck_date}` : undefined} />
        </div>
      </div>

      {/* Monthly */}
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          <CalendarDays className="w-4 h-4" /> Monthly
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Income" amount={fmt(stats.monthly_income)} icon={Wallet} accent="bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400" sub="Last paycheck × 2.17" />
          <StatCard title="Expenses" amount={fmt(stats.monthly_expenses)} icon={Receipt} accent="bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400" sub="Bills due next 30 days" />
          <StatCard title="Remaining" amount={fmt(stats.monthly_remaining)} icon={PiggyBank} accent="bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400" negative={stats.monthly_remaining < 0} sub="30-day rolling window" />
        </div>
      </div>

      {/* Bills due + last paycheck */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <CardTitle className="text-sm">Bills Due Before Next Paycheck</CardTitle>
            </div>
            {stats.next_paycheck_date && (
              <p className="text-xs text-gray-400 mb-3">Next paycheck: {stats.next_paycheck_date}</p>
            )}
            {stats.bills_before_next_pay.length > 0 ? (
              <>
                <div className="space-y-2">
                  {stats.bills_before_next_pay.map((bill) => {
                    const b = dueBadge(bill.due_date)
                    return (
                      <Link
                        key={bill.id}
                        href={`/budget/bills?bill=${bill.id}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2 hover:border-blue-500 hover:shadow-sm transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">{bill.payee_name || 'Unknown Payee'}</p>
                          <p className="text-xs text-gray-400">{bill.due_date}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(bill.amount)}</p>
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${b.cls}`}>{b.text}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
                <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-white">
                  Total: {fmt(stats.bills_before_next_pay_total)}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">No bills due before next paycheck.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <CardTitle className="text-sm mb-3">Last Paycheck</CardTitle>
            {stats.last_paycheck ? (
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-400">Pay Date</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{stats.last_paycheck.pay_date || stats.last_paycheck.check_date || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Gross Pay</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(stats.last_paycheck.gross_pay || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total Deductions</p>
                  <p className="text-sm font-semibold text-red-500">-{fmt((stats.last_paycheck.gross_pay || 0) - (stats.last_paycheck.net_pay || 0))}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Net Pay</p>
                  <p className="text-lg font-bold text-green-600">{fmt(stats.last_paycheck.net_pay || 0)}</p>
                </div>
                {stats.next_paycheck_date && (
                  <>
                    <div className="border-t border-gray-100 dark:border-gray-700 my-2" />
                    <div>
                      <p className="text-xs text-gray-400">Next estimated paycheck</p>
                      <p className="text-sm font-bold text-green-600">{stats.next_paycheck_date}</p>
                    </div>
                  </>
                )}
                <Link href={`/budget/paychecks/${stats.last_paycheck.id}`} className="inline-block mt-2">
                  <Button variant="secondary" size="sm"><ArrowRight className="w-4 h-4 mr-2" /> View Paystub</Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No paycheck data yet.{' '}
                <Link href="/budget/paychecks" className="text-blue-600 dark:text-blue-400 underline">Add a paycheck</Link>
              </p>
            )}
            <Link href="/budget/paychecks" className="inline-block mt-4">
              <Button variant="secondary" size="sm"><ArrowRight className="w-4 h-4 mr-2" /> View All Paychecks</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
