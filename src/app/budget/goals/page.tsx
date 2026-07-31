'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, TrendingDown, Target, DollarSign,
  Landmark, CreditCard, Wallet, PiggyBank,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'

interface BankAccount {
  id: number
  name: string
  account_type: string
  current_balance: number
  interest_rate: number
}

interface CreditCardAccount {
  id: number
  name: string
  current_balance: number
  interest_rate: number
}

interface Stats {
  total_bank: number
  total_credit: number
  last_paycheck_net: number
  monthly_expenses: number
}

interface DebtAccount {
  id: number
  name: string
  type: string
  balance: number
  interestRate: number
}

export default function GoalsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [cards, setCards] = useState<CreditCardAccount[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) router.push('/login')
  }, [user, router])

  const fetchData = useCallback(async () => {
    try {
      const [acctRes, cardRes, statsRes] = await Promise.all([
        fetch('/api/budget/bank-accounts'),
        fetch('/api/budget/credit-cards'),
        fetch('/api/budget/stats'),
      ])
      if (acctRes.ok) {
        const { accounts } = await acctRes.json()
        setAccounts(accounts)
      }
      if (cardRes.ok) {
        const { cards } = await cardRes.json()
        setCards(cards)
      }
      if (statsRes.ok) {
        const { stats } = await statsRes.json()
        setStats(stats)
      }
    } catch (e) {
      console.error('Failed to fetch goals data', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  const assetTypes = ['checking', 'savings', 'money_market', 'investment']
  const assetAccounts = accounts.filter(a => assetTypes.includes(a.account_type))
  const loanAccounts = accounts.filter(a => a.account_type === 'loan')

  const totalAssets = assetAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0)
  const totalLoans = loanAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0)
  const totalCreditCards = cards.reduce((sum, c) => sum + (c.current_balance || 0), 0)
  const totalDebt = totalLoans + totalCreditCards
  const netWorth = totalAssets - totalDebt

  const monthlyIncome = stats ? stats.last_paycheck_net * 26 / 12 : 0
  const monthlyBudget = stats ? stats.monthly_expenses : 0

  const allDebt: DebtAccount[] = [
    ...loanAccounts.map(a => ({
      id: a.id,
      name: a.name,
      type: 'Loan',
      balance: a.current_balance || 0,
      interestRate: a.interest_rate || 0,
    })),
    ...cards.map(c => ({
      id: c.id,
      name: c.name,
      type: 'Credit Card',
      balance: c.current_balance || 0,
      interestRate: c.interest_rate || 0,
    })),
  ].filter(d => d.balance > 0)

  const formatCurrency = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const getPayoffMonths = (balance: number) => {
    if (balance <= 0) return 0
    const monthlyPayment = balance * 0.03
    return Math.ceil(balance / monthlyPayment)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Goals &amp; Net Worth</h1>

        {/* Net Worth Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Assets</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalAssets)}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {assetAccounts.length} account{assetAccounts.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                  <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Debt</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalDebt)}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {allDebt.length} account{allDebt.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                  <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Net Worth</p>
                  <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(netWorth)}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${netWorth >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  <Target className={`w-6 h-6 ${netWorth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Income (est.)</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(monthlyIncome)}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Based on last paycheck x 26 / 12</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Wallet className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Budget</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(monthlyBudget)}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Total monthly expenses</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Debt Payoff List */}
        <Card>
          <CardContent>
            <CardTitle className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-red-500" />
              Debt Payoff Tracker
            </CardTitle>

            {allDebt.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No debt accounts found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Account</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Type</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Balance</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400">APR</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Min. Payment</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Months to Payoff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDebt.map(d => {
                      const monthlyPayment = d.balance * 0.03
                      const monthsToPayoff = getPayoffMonths(d.balance)
                      return (
                        <tr key={`${d.type}-${d.id}`} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">{d.name}</td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              d.type === 'Loan'
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {d.type}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-red-600 dark:text-red-400 font-medium">{formatCurrency(d.balance)}</td>
                          <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300">{d.interestRate}%</td>
                          <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(monthlyPayment)}</td>
                          <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300">{monthsToPayoff} mo</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
