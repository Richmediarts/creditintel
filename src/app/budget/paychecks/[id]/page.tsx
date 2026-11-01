'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

interface Paycheck {
  id: number
  pay_date?: string
  pay_period_begin?: string
  pay_period_end?: string
  check_date?: string
  check_number?: string
  employee_name?: string
  employee_id?: string
  company?: string
  hours_worked?: number
  salary?: number
  salary_hours?: number
  salary_rate?: number
  vacation_pay?: number
  vacation_hours?: number
  vacation_rate?: number
  holiday_pay?: number
  holiday_pay_hours?: number
  holiday_pay_rate?: number
  biometric_credit?: number
  biometric_credit_hours?: number
  biometric_credit_rate?: number
  spousal_biometric?: number
  spousal_biometric_hours?: number
  spousal_biometric_rate?: number
  group_term_life?: number
  group_term_life_hours?: number
  group_term_life_rate?: number
  floating_holiday?: number
  floating_holiday_hours?: number
  floating_holiday_rate?: number
  other_earnings?: number
  other_earnings_hours?: number
  other_earnings_rate?: number
  gross_pay?: number
  pre_tax_deductions?: number
  employee_taxes?: number
  post_tax_deductions?: number
  net_pay?: number
  oasdi?: number
  medicare?: number
  federal_tax?: number
  state_tax?: number
  state_name?: string
  retirement_401k?: number
  health_insurance?: number
  dental_plan?: number
  eye_plan?: number
  health_care_fsa?: number
  optional_life?: number
  add_insurance?: number
  hsa?: number
  loan_repayment?: number
  stock_purchase?: number
  spousal_life?: number
  dependent_life?: number
  employer_match?: number
  federal_filing_status?: string
  state_filing_status?: string
  bank_name?: string
  account_number?: string
  deposit_amount?: number
  bank2_name?: string
  account2_number?: string
  deposit2_amount?: number
}

const fmt = (n: number | undefined): string =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtHours = (n: number | undefined): string =>
  n === undefined || n === null ? '—' : String(n)

const fmtRate = (n: number | undefined): string =>
  n === undefined || n === null ? '—' : String(Math.round(n * 10000) / 10000)

function IdCell({ label, val }: { label: string; val?: string }) {
  return (
    <div className="px-3 py-2 border-r border-slate-200 dark:border-slate-600 last:border-r-0">
      <div className="text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300 font-mono mb-0.5">{label}</div>
      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 font-mono break-words">{val || '—'}</div>
    </div>
  )
}

export default function PaycheckViewPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [pc, setPc] = useState<Paycheck | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPaycheck = useCallback(async () => {
    const res = await fetch(`/api/budget/paychecks/${params?.id}`)
    if (res.ok) {
      const data = await res.json()
      setPc(data.paycheck)
    }
    setLoading(false)
  }, [params?.id])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user && params?.id) fetchPaycheck()
  }, [user, authLoading, params?.id, fetchPaycheck])

  const handleDelete = async () => {
    if (!window.confirm('Delete this paycheck?')) return
    await fetch(`/api/budget/paychecks/${pc?.id}`, { method: 'DELETE' })
    router.push('/budget/paychecks')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!pc) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Paycheck not found</h1>
        <Link href="/budget/paychecks"><Button variant="secondary"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Paychecks</Button></Link>
      </div>
    )
  }

  const hours = pc.hours_worked || 0
  const netPay = pc.net_pay || 0

  const earnings = [
    pc.salary && (pc.salary || 0) > 0 ? { label: 'Salary', amount: pc.salary, ytd: undefined, hours: pc.salary_hours, rate: pc.salary_rate } : null,
    pc.vacation_pay && (pc.vacation_pay || 0) > 0 ? { label: 'Vacation', amount: pc.vacation_pay, ytd: undefined, hours: pc.vacation_hours, rate: pc.vacation_rate } : null,
    pc.holiday_pay && (pc.holiday_pay || 0) > 0 ? { label: 'Holiday', amount: pc.holiday_pay, ytd: undefined, hours: pc.holiday_pay_hours, rate: pc.holiday_pay_rate } : null,
    pc.biometric_credit && (pc.biometric_credit || 0) > 0 ? { label: 'Biometric Credit', amount: pc.biometric_credit, ytd: undefined, hours: pc.biometric_credit_hours, rate: pc.biometric_credit_rate } : null,
    pc.spousal_biometric && (pc.spousal_biometric || 0) > 0 ? { label: 'Spousal Biometric Credit', amount: pc.spousal_biometric, ytd: undefined, hours: pc.spousal_biometric_hours, rate: pc.spousal_biometric_rate } : null,
    pc.group_term_life && (pc.group_term_life || 0) > 0 ? { label: 'Group Term Life', amount: pc.group_term_life, ytd: undefined, hours: pc.group_term_life_hours, rate: pc.group_term_life_rate } : null,
    pc.floating_holiday && (pc.floating_holiday || 0) > 0 ? { label: 'Floating Holiday', amount: pc.floating_holiday, ytd: undefined, hours: pc.floating_holiday_hours, rate: pc.floating_holiday_rate } : null,
    pc.other_earnings && (pc.other_earnings || 0) > 0 ? { label: 'Other Earnings', amount: pc.other_earnings, ytd: undefined, hours: pc.other_earnings_hours, rate: pc.other_earnings_rate } : null,
  ].filter(Boolean) as { label: string; amount: number; ytd?: number; hours?: number; rate?: number }[]

  const preTax = [
    pc.retirement_401k && (pc.retirement_401k || 0) > 0 ? { label: '401k Savings Plan', amount: pc.retirement_401k } : null,
    pc.health_insurance && (pc.health_insurance || 0) > 0 ? { label: 'Medical', amount: pc.health_insurance } : null,
    pc.dental_plan && (pc.dental_plan || 0) > 0 ? { label: 'Dental Plan', amount: pc.dental_plan } : null,
    pc.eye_plan && (pc.eye_plan || 0) > 0 ? { label: 'Eye Plan', amount: pc.eye_plan } : null,
    pc.health_care_fsa && (pc.health_care_fsa || 0) > 0 ? { label: 'Health Care FSA', amount: pc.health_care_fsa } : null,
    pc.optional_life && (pc.optional_life || 0) > 0 ? { label: 'Optional Life', amount: pc.optional_life } : null,
    pc.add_insurance && (pc.add_insurance || 0) > 0 ? { label: 'ADD Insurance', amount: pc.add_insurance } : null,
    pc.hsa && (pc.hsa || 0) > 0 ? { label: 'HSA', amount: pc.hsa } : null,
  ].filter(Boolean) as { label: string; amount: number }[]

  const postTax = [
    pc.loan_repayment && (pc.loan_repayment || 0) > 0 ? { label: '401K Loan Repayment', amount: pc.loan_repayment } : null,
    pc.stock_purchase && (pc.stock_purchase || 0) > 0 ? { label: 'Employee Stock Purchase', amount: pc.stock_purchase } : null,
    pc.spousal_life && (pc.spousal_life || 0) > 0 ? { label: 'Spousal Life Insurance', amount: pc.spousal_life } : null,
    pc.dependent_life && (pc.dependent_life || 0) > 0 ? { label: 'Dependent Life Insurance', amount: pc.dependent_life } : null,
  ].filter(Boolean) as { label: string; amount: number }[]

  const taxes = [
    pc.federal_tax && (pc.federal_tax || 0) > 0 ? { label: 'Federal Withholding', amount: pc.federal_tax } : null,
    pc.state_tax && (pc.state_tax || 0) > 0 ? { label: `State Tax — ${pc.state_name || 'GA'}`, amount: pc.state_tax } : null,
    pc.oasdi && (pc.oasdi || 0) > 0 ? { label: 'OASDI', amount: pc.oasdi } : null,
    pc.medicare && (pc.medicare || 0) > 0 ? { label: 'Medicare', amount: pc.medicare } : null,
  ].filter(Boolean) as { label: string; amount: number }[]

  const salaryHours = hours > 0 ? Math.round(hours * 0.7) : 56

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/budget/paychecks">
          <Button variant="secondary" size="sm"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Paychecks</Button>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/budget/paychecks">
            <Button size="sm"><Pencil className="w-4 h-4 mr-2" /> Edit</Button>
          </Link>
          <Button variant="danger" size="sm" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-2" /> Delete</Button>
        </div>
      </div>

      <Card className="paycheck-statement overflow-hidden">
        <div className="bg-slate-900 text-white px-8 py-6 flex justify-between items-start flex-wrap gap-4">
          <div>
            <div className="font-mono text-xl font-semibold">{pc.company || 'NCR VOYIX'}</div>
            <div className="font-mono text-xs text-slate-300 mt-2 leading-relaxed">
              864 Spring St NW, Atlanta, GA 30308<br />+1 (800) 225-5627
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs uppercase tracking-widest text-slate-300">Pay Statement</div>
            <div className="font-mono text-lg font-semibold mt-1">{pc.check_date || pc.pay_date || ''}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 lg:grid-cols-6 border-b-2 border-slate-300 dark:border-slate-500 bg-white dark:bg-gray-800">
          <IdCell label="Employee Name" val={pc.employee_name} />
          <IdCell label="Company" val={pc.company || 'NCR Voyix Corp.'} />
          <IdCell label="Employee ID" val={pc.employee_id} />
          <IdCell label="Period Begin" val={pc.pay_period_begin} />
          <IdCell label="Period End" val={pc.pay_period_end} />
          <IdCell label="Check Date" val={pc.check_date} />
        </div>

        {/* Summary strip */}
        <div className="bg-white dark:bg-gray-800">
          <div className="grid grid-cols-3 lg:grid-cols-7 bg-slate-900">
            {[
              { label: 'Period', right: false },
              { label: 'Hours Worked', right: true },
              { label: 'Gross Pay', right: true },
              { label: 'Pre-Tax Ded.', right: true },
              { label: 'Emp. Taxes', right: true },
              { label: 'Post-Tax Ded.', right: true },
              { label: 'Net Pay', right: true },
            ].map((h) => (
              <div key={h.label} className={`px-3 py-2 text-xs uppercase tracking-widest text-slate-300 font-mono ${h.right ? 'text-right' : 'text-left'}`}>
                {h.label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 lg:grid-cols-7 bg-slate-900">
            {[
              { label: 'Current', val: '', money: false },
              { label: '', val: String(hours), money: true },
              { label: '', val: fmt(pc.gross_pay), money: true },
              { label: '', val: fmt(pc.pre_tax_deductions), money: true },
              { label: '', val: fmt(pc.employee_taxes), money: true },
              { label: '', val: fmt(pc.post_tax_deductions), money: true },
              { label: '', val: fmt(pc.net_pay), money: true },
            ].map((c, i) => (
              <div key={i} className={`px-3 py-2 text-sm font-medium text-white font-mono ${c.money ? 'text-right' : 'text-left text-slate-300 uppercase'}`}>
                {c.label}{c.money ? c.val : c.val}
              </div>
            ))}
          </div>
        </div>

        <CardContent className="p-6 bg-slate-100 dark:bg-slate-950">
          <div className="max-w-[960px] mx-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-600 dark:border-gray-700 shadow-lg rounded-sm">
            {/* Net pay hero */}
            <div className="mx-6 my-4 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-700 rounded px-6 py-4 flex justify-between items-center flex-wrap gap-4">
              <div>
                <div className="font-mono text-xs uppercase tracking-widest text-emerald-800 dark:text-emerald-200">Net Pay — Current Period</div>
                <div className="font-mono text-3xl font-semibold text-emerald-800 dark:text-emerald-200 mt-1">{fmt(netPay)}</div>
              </div>
              <div className="text-right font-mono text-sm text-slate-600 dark:text-slate-300">
                Year-to-Date Net Pay
                <span className="block text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{fmt(pc.net_pay)}</span>
              </div>
            </div>

            {/* Earnings */}
            <div className="px-6 pb-2">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-mono text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300">Earnings</h2>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                    <th className="text-left py-1.5 pr-2 font-medium">Description</th>
                    <th className="text-right py-1.5 px-2 font-medium">Hours</th>
                    <th className="text-right py-1.5 px-2 font-medium">Rate</th>
                    <th className="text-right py-1.5 px-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.length > 0 ? earnings.map((e) => (
                    <tr key={e.label} className="border-b border-slate-200 dark:border-slate-600">
                      <td className="py-1.5 pr-2 text-slate-900 dark:text-slate-100">{e.label}</td>
                      <td className="text-right py-1.5 px-2 font-mono text-slate-600 dark:text-slate-300">{e.label === 'Salary' && e.hours === undefined ? salaryHours : fmtHours(e.hours)}</td>
                      <td className="text-right py-1.5 px-2 font-mono text-slate-600 dark:text-slate-300">{e.label === 'Salary' ? '—' : fmtRate(e.rate)}</td>
                      <td className="text-right py-1.5 px-2 font-mono font-medium text-slate-900 dark:text-slate-100">{fmt(e.amount)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="py-3 text-slate-600 dark:text-slate-300 text-center">No earnings breakdown recorded.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="py-1.5 pr-2 font-semibold text-slate-900 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-500">Total Earnings</td>
                    <td colSpan={2} className="border-t-2 border-slate-300 dark:border-slate-500" />
                    <td className="text-right py-1.5 px-2 font-mono font-semibold text-slate-900 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-500">{fmt(pc.gross_pay)}</td>
                  </tr>
                </tfoot>
              </table></div>
            </div>

            {/* Deductions two-col */}
            <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="font-mono text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300">Pre-Tax Deductions</h2>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
                  <span className="font-mono text-xs uppercase px-2 py-0.5 rounded-full bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200 font-semibold">Pre-Tax</span>
                </div>
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                      <th className="text-left py-1.5 pr-2 font-medium">Description</th>
                      <th className="text-right py-1.5 px-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preTax.length > 0 ? preTax.map((d) => (
                      <tr key={d.label} className="border-b border-slate-200 dark:border-slate-600">
                        <td className="py-1.5 pr-2 text-slate-900 dark:text-slate-100">{d.label}</td>
                        <td className="text-right py-1.5 px-2 font-mono text-slate-900 dark:text-slate-100">{fmt(d.amount)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={2} className="py-3 text-slate-600 dark:text-slate-300 text-center">None</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="py-1.5 pr-2 font-semibold border-t-2 border-slate-300 dark:border-slate-500">Total</td>
                      <td className="text-right py-1.5 px-2 font-mono font-semibold border-t-2 border-slate-300 dark:border-slate-500">{fmt(pc.pre_tax_deductions)}</td>
                    </tr>
                  </tfoot>
                </table></div>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="font-mono text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300">Post-Tax Deductions</h2>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
                  <span className="font-mono text-xs uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200 font-semibold">Post-Tax</span>
                </div>
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                      <th className="text-left py-1.5 pr-2 font-medium">Description</th>
                      <th className="text-right py-1.5 px-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {postTax.length > 0 ? postTax.map((d) => (
                      <tr key={d.label} className="border-b border-slate-200 dark:border-slate-600">
                        <td className="py-1.5 pr-2 text-slate-900 dark:text-slate-100">{d.label}</td>
                        <td className="text-right py-1.5 px-2 font-mono text-slate-900 dark:text-slate-100">{fmt(d.amount)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={2} className="py-3 text-slate-600 dark:text-slate-300 text-center">None</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="py-1.5 pr-2 font-semibold border-t-2 border-slate-300 dark:border-slate-500">Total</td>
                      <td className="text-right py-1.5 px-2 font-mono font-semibold border-t-2 border-slate-300 dark:border-slate-500">{fmt(pc.post_tax_deductions)}</td>
                    </tr>
                  </tfoot>
                </table></div>
              </div>
            </div>

            {/* Employee taxes */}
            <div className="px-6 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-mono text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300">Employee Taxes</h2>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                    <th className="text-left py-1.5 pr-2 font-medium">Description</th>
                    <th className="text-right py-1.5 px-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {taxes.length > 0 ? taxes.map((t) => (
                    <tr key={t.label} className="border-b border-slate-200 dark:border-slate-600">
                      <td className="py-1.5 pr-2 text-slate-900 dark:text-slate-100">{t.label}</td>
                      <td className="text-right py-1.5 px-2 font-mono text-slate-900 dark:text-slate-100">{fmt(t.amount)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={2} className="py-3 text-slate-600 dark:text-slate-300 text-center">None</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="py-1.5 pr-2 font-semibold border-t-2 border-slate-300 dark:border-slate-500">Total Employee Taxes</td>
                    <td className="text-right py-1.5 px-2 font-mono font-semibold border-t-2 border-slate-300 dark:border-slate-500">{fmt(pc.employee_taxes)}</td>
                  </tr>
                </tfoot>
              </table></div>
            </div>

            {/* Direct deposit */}
            <div className="px-6 pb-6">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-mono text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300">Direct Deposit</h2>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
              </div>
              <div className="flex gap-4 flex-wrap">
                {(pc.bank_name || (pc.deposit_amount || 0) > 0) && (
                  <div className="flex-1 min-w-[180px] border border-slate-200 dark:border-slate-600 rounded px-4 py-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-orange-500" />
                    <div className="font-mono text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300">{pc.bank_name || 'Primary Bank'}</div>
                    <div className="font-mono text-sm text-slate-600 dark:text-slate-300 my-1">Account ······{pc.account_number || '****'}</div>
                    <div className="font-mono text-lg font-semibold">{fmt(pc.deposit_amount)} <span className="text-xs text-slate-600 dark:text-slate-300">USD</span></div>
                  </div>
                )}
                {(pc.bank2_name || (pc.deposit2_amount || 0) > 0) && (
                  <div className="flex-1 min-w-[180px] border border-slate-200 dark:border-slate-600 rounded px-4 py-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-blue-500" />
                    <div className="font-mono text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300">{pc.bank2_name || 'Secondary Bank'}</div>
                    <div className="font-mono text-sm text-slate-600 dark:text-slate-300 my-1">Account ······{pc.account2_number || '****'}</div>
                    <div className="font-mono text-lg font-semibold">{fmt(pc.deposit2_amount)} <span className="text-xs text-slate-600 dark:text-slate-300">USD</span></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
