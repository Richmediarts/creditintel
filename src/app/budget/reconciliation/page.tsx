"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, Receipt, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { PayPeriodReconciliation } from '@/lib/payperiod-planner'

type Account = { id: number; name: string; kind: 'bank' | 'credit'; owner: string | null }
type Payload = { reconciliation: PayPeriodReconciliation; accounts: Account[]; canEdit: boolean }
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const owners: Record<string, string> = { me: 'Mine', wife: "Spouse’s", shared: 'Shared', unassigned: 'Unassigned' }

export default function ReconciliationPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<Payload | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const periodNav = useRef<HTMLElement>(null)
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/budget/reconciliation')
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load transactions.')
      setData(result)
      setActive(previous => previous ?? result.reconciliation.currentPeriodIndex)
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to load transactions.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
    if (user) void load()
  }, [authLoading, user, router, load])
  useEffect(() => {
    const nav = periodNav.current
    const selected = nav?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (nav && selected) {
      nav.scrollLeft += selected.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - selected.offsetWidth) / 2
    }
  }, [active, data])
  async function assign(account: Account, owner: string) {
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/budget/reconciliation', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account.id, kind: account.kind, owner }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to save owner.')
      await load(); setNotice('Account owner saved. Spending totals updated.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save owner.') }
    finally { setSaving(false) }
  }
  const reconciliation = data?.reconciliation
  const current = reconciliation?.windows.find(w => w.index === active) || reconciliation?.windows[0]
  return <div className="space-y-6">
    <div className="money-hero rounded-2xl p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Your household, in focus</p>
      <h1 className="mt-2 text-2xl sm:text-3xl font-bold">Where did this paycheck go?</h1>
      <p className="mt-2 text-sm text-blue-100">Compare your pay-period plan with recorded spending, by category, account, and spouse.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/budget" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/40 px-4 py-2 text-sm"><ArrowLeft className="w-4 h-4" /> Pay-period plan</Link>
        <Button disabled={loading} onClick={() => void load()}><RefreshCw className="w-4 h-4 mr-2" />{loading ? 'Loading…' : 'Refresh records'}</Button>
      </div>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">{error}</div>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{notice}</p>}
    {!data && loading && <p role="status">Loading your pay-period records…</p>}
    {reconciliation && <>
      {reconciliation.skippedUnknownAccount > 0 && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        <strong>Incomplete transaction coverage:</strong> {reconciliation.skippedUnknownAccount} transactions have an unresolved or missing account and are excluded from these totals. Use Sync Transactions on Bank Accounts and Credit Cards to refresh linked records. Imported records may need their account identity corrected. These totals are partial until those records are resolved.
      </div>}
      <nav ref={periodNav} aria-label="Choose a pay period" className="flex gap-3 overflow-x-auto pb-2">
        {reconciliation.windows.map(w => <button key={w.index} type="button" aria-pressed={w.index === current?.index} onClick={() => setActive(w.index)} className={`period-chip min-w-48 rounded-xl border p-4 text-left ${w.index === current?.index ? 'active bg-indigo-50 border-indigo-400 dark:bg-indigo-950' : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}>
          <span className="block text-sm font-semibold">{w.start} – {w.end}</span><span className="mt-1 block text-xs text-gray-600 dark:text-gray-300">{money(w.spendingActual)} recorded spending</span>
        </button>)}
      </nav>
      {current && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[['Planned allocations', current.planned, 'chip-spending'], ['Recorded spending', current.spendingActual, 'chip-bills'], ['Bank inflows', current.incomeActual, 'chip-income'], ['Card payments · separate', current.cardPayments, 'chip-credit']].map(([label, value, color]) => <Card key={String(label)}><CardContent><p className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{label}</p><p className="mt-3 text-2xl font-bold tabular-nums">{money(Number(value))}</p></CardContent></Card>)}
        </div>
        <Card><CardContent>
          <CardTitle>Understand this comparison</CardTitle>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Planned allocations include bills, allowances, reserves, and planned debt payments. Recorded spending includes bank expenses and card purchases. These use different timing, so the difference is not cash available to spend. Your pay-period plan remains the place to check available money.</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
            <div><dt className="text-gray-500 dark:text-gray-400">Transfers out / in · excluded</dt><dd className="font-semibold">{money(current.transfersOut)} / {money(current.transfersIn)}</dd></div>
            <div><dt className="text-gray-500 dark:text-gray-400">Card credits · excluded</dt><dd className="font-semibold">{money(current.cardCredits)}</dd></div>
            <div><dt className="text-gray-500 dark:text-gray-400">Uncategorized expenses · included</dt><dd className="font-semibold">{current.uncategorizedSpendingCount} transactions</dd></div>
          </dl>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Card payments are separate from spending so purchases count once. Card credits can include refunds and payments; spending shown here is before card refunds. Bank inflows exclude categorized transfers but may include deposits other than paychecks. Refresh reads stored records; it does not contact your bank.</p>
        </CardContent></Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardContent><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-rose-500" />Spending by category</CardTitle>
            {current.byCategory.length ? <div className="mt-4 space-y-4">{current.byCategory.map(c => <div key={c.category}><div className="flex justify-between gap-3 text-sm"><span className="capitalize">{c.category.replaceAll('_', ' ').toLowerCase()}</span><strong className="tabular-nums">{money(c.amount)}</strong></div><div className="mt-2 h-2 rounded-full bg-indigo-100 dark:bg-indigo-950"><div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.min(100, current.spendingActual > 0 ? c.amount / current.spendingActual * 100 : 0)}%` }} /></div></div>)}</div> : <p className="mt-4 text-sm text-gray-500">No recorded spending in this period. Future periods fill as transactions arrive.</p>}
          </CardContent></Card>
          <Card><CardContent><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-cyan-600" />Spending by spouse</CardTitle><dl className="mt-4 space-y-4">{Object.entries(current.bySpouse).map(([owner, amount]) => <div key={owner} className="flex justify-between text-sm"><dt>{owners[owner] || 'Unassigned'}</dt><dd className="font-semibold tabular-nums">{money(amount)}</dd></div>)}</dl><p className="mt-4 text-xs text-gray-500 dark:text-gray-400">Ownership follows the account assignment below. Shared spending remains a separate total.</p></CardContent></Card>
        </div>
        <Card><CardContent><CardTitle>Spending by account</CardTitle><div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 dark:border-gray-700"><th className="py-3 text-left">Account</th><th className="py-3 text-left">Owner</th><th className="py-3 text-right">Spending</th></tr></thead><tbody>{current.byAccount.map(a => <tr key={a.account + a.owner} className="border-b border-gray-100 dark:border-gray-700"><td className="py-3 pr-3">{a.account}</td><td>{owners[a.owner] || 'Unassigned'}</td><td className="text-right tabular-nums">{money(a.amount)}</td></tr>)}</tbody></table></div></CardContent></Card>
      </>}
      <Card><CardContent><CardTitle>Who uses each account?</CardTitle><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Assign accounts to keep household spending organized. Existing accounts start as Mine; update your spouse’s and shared accounts here.</p>
        <div className="mt-4 space-y-3">{data.accounts.map(a => <div key={a.kind + a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"><div className="min-w-0"><p className="text-sm font-semibold break-words">{a.name}</p><p className="text-xs text-gray-500">{a.kind === 'credit' ? 'Credit card' : 'Bank account'}</p></div><label className="flex items-center gap-2 text-sm"><span className="sr-only">Owner of {a.name}</span><select aria-label={`Owner of ${a.name}`} className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 dark:border-gray-600 dark:bg-gray-900" disabled={!data.canEdit || saving} value={a.owner || 'me'} onChange={e => void assign(a, e.target.value)}><option value="me">Mine</option><option value="wife">Spouse’s</option><option value="shared">Shared</option></select></label></div>)}</div>
        {!data.canEdit && <p className="mt-3 text-xs text-gray-500">The budget owner manages account assignments.</p>}
      </CardContent></Card>
    </>}
  </div>
}
