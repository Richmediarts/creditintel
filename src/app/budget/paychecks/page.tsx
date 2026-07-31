'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Eye, Pencil, Trash2, Plus, ArrowLeft, Save, X, Info, Wallet,
} from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

interface Paycheck {
  id: number
  [key: string]: unknown
}

const fmt = (n: unknown): string =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const EMPTY_FORM: Record<string, string> = {
  employee_name: '', company: '', employee_id: '',
  pay_period_begin: '', pay_period_end: '', check_date: '', check_number: '',
  hours_worked: '0', gross_pay: '0', net_pay: '0', pre_tax_deductions: '0',
  employee_taxes: '0', post_tax_deductions: '0',
  federal_tax: '0', state_tax: '0', oasdi: '0', medicare: '0', state_name: '',
  federal_filing_status: '', state_filing_status: '',
  retirement_401k: '0', health_insurance: '0', dental_plan: '0', eye_plan: '0',
  health_care_fsa: '0', optional_life: '0', add_insurance: '0', hsa: '0',
  loan_repayment: '0', stock_purchase: '0', spousal_life: '0', dependent_life: '0',
  salary: '0', vacation_pay: '0', holiday_pay: '0', biometric_credit: '0',
  spousal_biometric: '0', group_term_life: '0', floating_holiday: '0', other_earnings: '0',
  bank_name: '', account_number: '', deposit_amount: '0',
  bank2_name: '', account2_number: '', deposit2_amount: '0',
  notes: '',
}

function NumberField({
  label, name, value, onChange, span,
}: {
  label: string
  name: string
  value: string
  onChange: (name: string, v: string) => void
  span?: string
}) {
  return (
    <div className={span || 'md:col-span-2'}>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <input
        type="number"
        step="0.01"
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function TextField({
  label, name, value, onChange, span,
}: {
  label: string
  name: string
  value: string
  onChange: (name: string, v: string) => void
  span?: string
}) {
  return (
    <div className={span || 'md:col-span-2'}>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function DateField({
  label, name, value, onChange, span,
}: {
  label: string
  name: string
  value: string
  onChange: (name: string, v: string) => void
  span?: string
}) {
  return (
    <div className={span || 'md:col-span-2'}>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <input
        type="date"
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-12 border-b border-gray-200 dark:border-gray-700 pb-2 mb-2 mt-4">
      <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400">{children}</h3>
    </div>
  )
}

export default function PaychecksPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [paychecks, setPaychecks] = useState<Paycheck[]>([])
  const [nextPaycheck, setNextPaycheck] = useState<string | null>(null)
  const [editing, setEditing] = useState<Paycheck | null>(null)
  const [form, setForm] = useState<Record<string, string>>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const fetchPaychecks = useCallback(async () => {
    const res = await fetch('/api/budget/paychecks')
    if (res.ok) {
      const data = await res.json()
      setPaychecks(data.paychecks)
      setNextPaycheck(data.nextPaycheck)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return }
    if (user) fetchPaychecks()
  }, [user, authLoading, fetchPaychecks])

  const setField = (name: string, v: string) => setForm((f) => ({ ...f, [name]: v }))

  const startAdd = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startEdit = (pc: Paycheck) => {
    setEditing(pc)
    const next: Record<string, string> = {}
    for (const key of Object.keys(EMPTY_FORM)) {
      const v = pc[key]
      next[key] = v === null || v === undefined ? '' : String(v)
    }
    setForm(next)
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    const payload: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(form)) {
      if (['check_date', 'pay_date', 'pay_period_begin', 'pay_period_end'].includes(key) && !val) continue
      payload[key] = val
    }

    const url = editing ? `/api/budget/paychecks/${editing.id}` : '/api/budget/paychecks'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(editing ? 'Paycheck updated' : 'Paycheck added')
      setEditing(null)
      setForm({ ...EMPTY_FORM })
      await fetchPaychecks()
    } else {
      setError(data.error || 'Failed to save paycheck')
    }
    setSaving(false)
  }

  const handleDelete = async (pc: Paycheck) => {
    if (!window.confirm('Delete this paycheck?')) return
    await fetch(`/api/budget/paychecks/${pc.id}`, { method: 'DELETE' })
    await fetchPaychecks()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Paychecks & Paystubs</h1>
          <p className="text-sm text-gray-500">Track biweekly paychecks and view paystubs.</p>
        </div>
        {!editing && (
          <Button onClick={startAdd}><Plus className="w-4 h-4 mr-2" /> Add Paycheck</Button>
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

      {(editing || !paychecks.length) && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-sm">
                {editing ? `Edit Paycheck — ${editing.check_date || editing.pay_date || ''}` : 'Add Paycheck'}
              </CardTitle>
              {editing && (
                <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setForm({ ...EMPTY_FORM }) }}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <SectionTitle>Employee Information</SectionTitle>
                <TextField label="Employee Name" name="employee_name" value={form.employee_name} onChange={setField} />
                <TextField label="Company" name="company" value={form.company} onChange={setField} />
                <TextField label="Employee ID" name="employee_id" value={form.employee_id} onChange={setField} />

                <SectionTitle>Pay Period</SectionTitle>
                <DateField label="Pay Period Begin" name="pay_period_begin" value={form.pay_period_begin} onChange={setField} />
                <DateField label="Pay Period End" name="pay_period_end" value={form.pay_period_end} onChange={setField} />
                <DateField label="Check Date" name="check_date" value={form.check_date} onChange={setField} />
                <TextField label="Check Number" name="check_number" value={form.check_number} onChange={setField} />

                <SectionTitle>Summary</SectionTitle>
                <NumberField label="Hours Worked" name="hours_worked" value={form.hours_worked} onChange={setField} />
                <NumberField label="Gross Pay" name="gross_pay" value={form.gross_pay} onChange={setField} />
                <NumberField label="Net Pay" name="net_pay" value={form.net_pay} onChange={setField} />
                <NumberField label="Pre-Tax Deductions" name="pre_tax_deductions" value={form.pre_tax_deductions} onChange={setField} />
                <NumberField label="Employee Taxes" name="employee_taxes" value={form.employee_taxes} onChange={setField} />
                <NumberField label="Post-Tax Deductions" name="post_tax_deductions" value={form.post_tax_deductions} onChange={setField} />

                <SectionTitle>Taxes</SectionTitle>
                <NumberField label="Federal Tax" name="federal_tax" value={form.federal_tax} onChange={setField} />
                <NumberField label="State Tax" name="state_tax" value={form.state_tax} onChange={setField} />
                <NumberField label="OASDI" name="oasdi" value={form.oasdi} onChange={setField} />
                <NumberField label="Medicare" name="medicare" value={form.medicare} onChange={setField} />
                <TextField label="State Name" name="state_name" value={form.state_name} onChange={setField} />
                <TextField label="Federal Filing Status" name="federal_filing_status" value={form.federal_filing_status} onChange={setField} />
                <TextField label="State Filing Status" name="state_filing_status" value={form.state_filing_status} onChange={setField} />

                <SectionTitle>Pre-Tax Deductions</SectionTitle>
                <NumberField label="401(k)" name="retirement_401k" value={form.retirement_401k} onChange={setField} />
                <NumberField label="Medical" name="health_insurance" value={form.health_insurance} onChange={setField} />
                <NumberField label="Dental" name="dental_plan" value={form.dental_plan} onChange={setField} />
                <NumberField label="Vision" name="eye_plan" value={form.eye_plan} onChange={setField} />
                <NumberField label="FSA" name="health_care_fsa" value={form.health_care_fsa} onChange={setField} />
                <NumberField label="Optional Life" name="optional_life" value={form.optional_life} onChange={setField} />
                <NumberField label="ADD Insurance" name="add_insurance" value={form.add_insurance} onChange={setField} />
                <NumberField label="HSA" name="hsa" value={form.hsa} onChange={setField} />

                <SectionTitle>Post-Tax Deductions</SectionTitle>
                <NumberField label="Loan Repayment" name="loan_repayment" value={form.loan_repayment} onChange={setField} />
                <NumberField label="Stock Purchase" name="stock_purchase" value={form.stock_purchase} onChange={setField} />
                <NumberField label="Spousal Life" name="spousal_life" value={form.spousal_life} onChange={setField} />
                <NumberField label="Dependent Life" name="dependent_life" value={form.dependent_life} onChange={setField} />

                <SectionTitle>Earnings</SectionTitle>
                <NumberField label="Salary" name="salary" value={form.salary} onChange={setField} />
                <NumberField label="Vacation Pay" name="vacation_pay" value={form.vacation_pay} onChange={setField} />
                <NumberField label="Holiday Pay" name="holiday_pay" value={form.holiday_pay} onChange={setField} />
                <NumberField label="Biometric Credit" name="biometric_credit" value={form.biometric_credit} onChange={setField} />
                <NumberField label="Spousal Biometric" name="spousal_biometric" value={form.spousal_biometric} onChange={setField} />
                <NumberField label="Group Term Life" name="group_term_life" value={form.group_term_life} onChange={setField} />
                <NumberField label="Floating Holiday" name="floating_holiday" value={form.floating_holiday} onChange={setField} />
                <NumberField label="Other Earnings" name="other_earnings" value={form.other_earnings} onChange={setField} />

                <SectionTitle>Direct Deposit</SectionTitle>
                <TextField label="Bank Name" name="bank_name" value={form.bank_name} onChange={setField} />
                <NumberField label="Deposit Amount" name="deposit_amount" value={form.deposit_amount} onChange={setField} />
                <TextField label="Account Number" name="account_number" value={form.account_number} onChange={setField} />
                <TextField label="Bank 2 Name" name="bank2_name" value={form.bank2_name} onChange={setField} />
                <TextField label="Account 2 Number" name="account2_number" value={form.account2_number} onChange={setField} />
                <NumberField label="Deposit 2 Amount" name="deposit2_amount" value={form.deposit2_amount} onChange={setField} />

                <SectionTitle>Notes</SectionTitle>
                <div className="md:col-span-4">
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <Button type="submit" disabled={saving}>
                  <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Paycheck'}
                </Button>
                <Link href="/budget">
                  <Button variant="secondary"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="text-sm">Paystub History</CardTitle>
            <Badge variant="info">{paychecks.length} Paychecks</Badge>
          </div>
          {nextPaycheck && (
            <p className="text-xs text-gray-400 mb-3">
              <Info className="w-3.5 h-3.5 inline mr-1" />Next estimated paycheck: <span className="font-medium text-gray-600 dark:text-gray-300">{nextPaycheck}</span>
            </p>
          )}

          {paychecks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-3">Check Date</th>
                    <th className="py-2 pr-3">Employee</th>
                    <th className="py-2 pr-3">Company</th>
                    <th className="py-2 pr-3 text-right">Gross</th>
                    <th className="py-2 pr-3 text-right">Net Pay</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paychecks.map((pc) => (
                    <tr key={pc.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-3 text-gray-900 dark:text-white">{String(pc.check_date || pc.pay_date || '—')}</td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{String(pc.employee_name || 'N/A')}</td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{String(pc.company || 'N/A')}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-gray-900 dark:text-white">{fmt(pc.gross_pay)}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-green-600">{fmt(pc.net_pay)}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <Link href={`/budget/paychecks/${pc.id}`} className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-medium mr-3">
                          <Eye className="w-3.5 h-3.5" /> View
                        </Link>
                        <button onClick={() => startEdit(pc)} className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium mr-3">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => handleDelete(pc)} className="inline-flex items-center gap-1 text-red-500 text-xs font-medium">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Wallet className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No paychecks recorded yet.</p>
              <Button onClick={startAdd} className="mt-3"><Plus className="w-4 h-4 mr-2" /> Add your first paycheck</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
