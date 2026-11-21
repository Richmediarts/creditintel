'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Wallet } from 'lucide-react'
import type { WindowReconcile } from '@/lib/utils/reconcile'

interface OverviewPeriod {
  period: { start: string; end: string; label: string; index: number }
  availableNow: number
  availableToSpend: number
  projectedEndingBalance: number
  totalOutgoing: number
  billsTotal: number
  allowancesTotal: number
  reservesTotal: number
  minimumDebtPayments: number
  unknownCount: number
  bills: { bill: { isPaid: boolean } }[]
  incoming: { receivedTotal: number; expectedTotal: number }
}
interface Segment { label: string; value: number; color: string }
const colors = ['#b39aff', '#fa7cb6', '#3ce2ca', '#ffd35c', '#65b7ff', '#ffad78']
const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const categoryName = (name: string) => name.toLowerCase().replaceAll('_', ' ').split(' ').map(word => word ? word[0].toUpperCase() + word.slice(1) : '').join(' ')

export function BudgetVisualOverview({ current, anchor, periodCount, projected, reserves, onChooseAccounts }: {
  current: OverviewPeriod
  anchor: string
  periodCount: number
  projected: boolean
  reserves: { amountSaved: number; targetAmount: number }[]
  onChooseAccounts: () => void
}) {
  const [recorded, setRecorded] = useState<{ key: string; windows?: WindowReconcile[]; skipped?: number; error?: string } | null>(null)
  const [retry, setRetry] = useState(0)
  const key = anchor + ':' + periodCount
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const params = new URLSearchParams({ payday: anchor, periods: String(periodCount) })
        const response = await fetch('/api/budget/reconciliation?' + params, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Recorded activity is unavailable.')
        if (!controller.signal.aborted) setRecorded({ key, windows: data.reconciliation.windows, skipped: Number(data.reconciliation.skippedUnknownAccount) || 0 })
      } catch (error) {
        if (!controller.signal.aborted) setRecorded({ key, error: error instanceof Error ? error.message : 'Recorded activity is unavailable.' })
      }
    }
    void load()
    return () => controller.abort()
  }, [anchor, periodCount, key, retry])
  const actual = recorded?.key === key ? recorded.windows?.find(window => window.start === current.period.start && window.end === current.period.end) : undefined
  const error = recorded?.key === key ? recorded.error : undefined
  const loading = recorded?.key !== key
  const unmatched = recorded?.key === key ? recorded.skipped ?? 0 : 0
  const categories = (actual?.byCategory ?? []).filter(category => category.amount > 0).sort((a, b) => b.amount - a.amount)
  const spending: Segment[] = categories.slice(0, 5).map((category, index) => ({ label: categoryName(category.category), value: category.amount, color: colors[index] }))
  const other = categories.slice(5).reduce((sum, category) => sum + category.amount, 0)
  if (other > 0) spending.push({ label: 'Other spending', value: other, color: colors[5] })
  const allocations: Segment[] = [
    { label: 'Bills', value: current.billsTotal, color: '#fa7cb6' },
    { label: 'Spending allowances', value: current.allowancesTotal, color: '#b39aff' },
    { label: 'Savings / reserves', value: current.reservesTotal, color: '#ffd35c' },
    { label: 'Debt minimums', value: current.minimumDebtPayments, color: '#3ce2ca' },
  ]
  const paid = current.bills.filter(item => item.bill.isPaid).length
  const allBills = current.bills.length
  const saved = reserves.reduce((sum, reserve) => sum + reserve.amountSaved, 0)
  const target = reserves.reduce((sum, reserve) => sum + reserve.targetAmount, 0)
  const month = new Date(current.period.start + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const ledger = [
    { label: 'Starting cash', amount: current.availableNow },
    { label: 'Expected income', amount: current.incoming.expectedTotal },
    { label: 'Bills', amount: -current.billsTotal },
    { label: 'Spending allowances', amount: -current.allowancesTotal },
    { label: 'Savings / reserves', amount: -current.reservesTotal },
    { label: 'Debt minimums', amount: -current.minimumDebtPayments },
  ]
  return (
    <section className="studio-overview" aria-label="Budget dashboard overview">
      <div className="studio-top-grid">
        <div className="studio-panel studio-summary">
          <p className="studio-eyebrow">Household budget dashboard</p>
          <h1>{month}</h1>
          <p className="studio-period"><CalendarDays size={15} aria-hidden="true" />{current.period.label}</p>
          <dl className="studio-date-list"><div><dt>Start date</dt><dd>{current.period.start}</dd></div><div><dt>End date</dt><dd>{current.period.end}</dd></div></dl>
          <button type="button" className="studio-balance studio-balance-cash" aria-haspopup="dialog" onClick={onChooseAccounts}>
            <span>{projected ? 'Projected starting cash' : 'Money available right now'}</span>
            <strong className={current.availableNow < 0 ? 'studio-negative' : ''}>{money(current.availableNow)}</strong>
            <small><Wallet size={12} aria-hidden="true" />Choose available accounts</small>
          </button>
          <div className="studio-balance studio-balance-projected"><span>Projected end balance</span><strong className={current.projectedEndingBalance < 0 ? 'studio-negative' : ''}>{money(current.projectedEndingBalance)}</strong><small>Includes expected income · not cash in hand</small></div>
        </div>
        <div className="studio-panel studio-chart-panel">
          <h2>Planned breakdown</h2>
          <Donut segments={allocations} value={money(current.totalOutgoing)} caption="known allocations" empty="No planned allocations" />
          <p className="studio-footnote">{current.unknownCount ? current.unknownCount + ' unknown bill amount(s) excluded from totals.' : 'Bills, spending, savings reserves and debt minimums.'}</p>
        </div>
        <div className="studio-panel studio-chart-panel">
          <div className="studio-panel-heading"><h2>Recorded spending</h2><Link href="/budget/reconciliation">View activity ↗</Link></div>
          {loading ? <p role="status" className="studio-chart-message">Loading recorded transactions…</p> : error ? <div className="studio-chart-message"><p>{error}</p><button type="button" className="studio-retry" onClick={() => setRetry(value => value + 1)}>Retry activity</button></div> : actual ? <>
            <Donut segments={spending} value={money(actual.spendingActual)} caption="recorded purchases" empty="No recorded spending" />
            <p className="studio-footnote">Purchases counted once. Card payments and transfers stay separate.</p>
          </> : <p className="studio-chart-message">No matching recorded window is available. <Link href="/budget/reconciliation">Review activity</Link></p>}
          {unmatched > 0 && <p className="studio-footnote">{unmatched} transaction(s) across the loaded periods have unresolved account mapping and are excluded. <Link href="/budget/reconciliation">Review unmatched activity ↗</Link></p>}
        </div>
      </div>
      <div className="studio-bottom-grid">
        <div className="studio-panel studio-flow-panel">
          <h2>Recorded cash activity</h2>
          <FlowBar label="Incoming" value={actual?.incomeActual} max={Math.max(actual?.incomeActual ?? 0, actual?.spendingActual ?? 0, 1)} color="#3ce2ca" icon="in" />
          <FlowBar label="Purchases" value={actual?.spendingActual} max={Math.max(actual?.incomeActual ?? 0, actual?.spendingActual ?? 0, 1)} color="#fa7cb6" icon="out" />
          <p className="studio-footnote">{actual ? 'Card payments: ' + money(actual.cardPayments) + ' · shown separately, not added to purchases.' : 'Recorded totals appear when activity loads successfully.'}</p>
          <div className="studio-completion"><MiniRing percent={allBills ? paid / allBills * 100 : null} label={paid + '/' + allBills} /><div><h3>Bills marked paid</h3><p>{allBills ? Math.round(paid / allBills * 100) + '% of scheduled bills' : 'No bills scheduled'}</p><Link href="/budget/bills">Manage household bills ↗</Link></div></div>
        </div>
        <div className="studio-panel studio-ledger-panel">
          <h2>Pay-period balance sheet</h2>
          <div className="studio-table-scroll"><table><thead><tr><th scope="col">Allocation</th><th scope="col">Planned</th></tr></thead><tbody>
            {ledger.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td className={row.amount < 0 ? 'studio-money-out' : ''}>{money(row.amount)}</td></tr>)}
          </tbody><tfoot><tr><th scope="row">Projected end balance</th><td className={current.projectedEndingBalance < 0 ? 'studio-negative' : ''}>{money(current.projectedEndingBalance)}</td></tr></tfoot></table></div>
          <p className="studio-footnote">Received income is already in starting cash and is never added twice.</p>
        </div>
        <div className="studio-panel studio-savings-panel">
          <div className="studio-panel-heading"><h2>Savings tracker</h2><Link href="#budget-reserves">Manage reserves ↗</Link></div>
          <strong className="studio-savings-total">{money(saved)}</strong><p className="studio-footnote">Saved toward {money(target)} in reserve targets</p>
          <Progress percent={target > 0 ? saved / target * 100 : null} label="Reserve funding progress" />
          <div className="studio-saving-facts"><div><span>Set aside this period</span><strong>{money(current.reservesTotal)}</strong></div><div><span>Available after allocations</span><strong className={current.availableToSpend < 0 ? 'studio-negative' : ''}>{money(current.availableToSpend)}</strong></div></div>
          <Link href="/budget/goals" className="studio-goals-link">Open goals &amp; savings ↗</Link>
        </div>
      </div>
    </section>
  )
}
function Donut({ segments, value, caption, empty }: { segments: Segment[]; value: string; caption: string; empty: string }) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  let cursor = 0
  const stops = segments.filter(segment => segment.value > 0).map(segment => {
    const start = cursor
    cursor += segment.value / total * 100
    return segment.color + ' ' + start + '% ' + cursor + '%'
  })
  return <div className="studio-donut-content">
    <div className="studio-donut" role="img" aria-label={total ? segments.filter(segment => segment.value > 0).map(segment => segment.label + ': ' + money(segment.value)).join(', ') : empty}
      style={{ background: total ? 'conic-gradient(' + stops.join(', ') + ')' : '#444256' }}>
      <div className="studio-donut-center"><strong>{value}</strong><span>{total ? caption : empty}</span></div>
    </div>
    <ul className="studio-legend">{segments.filter(segment => segment.value > 0).map(segment => <li key={segment.label}><span className="studio-swatch" style={{ background: segment.color }} /><span>{segment.label}</span><strong>{money(segment.value)}</strong></li>)}</ul>
  </div>
}
function FlowBar({ label, value, max, color, icon }: { label: string; value?: number; max: number; color: string; icon: string }) {
  return <div className="studio-flow"><span>{icon === 'in' ? <ArrowDownLeft size={14} aria-hidden="true" /> : <ArrowUpRight size={14} aria-hidden="true" />}{label}</span><div className="studio-bar-track"><div className="studio-bar-fill" style={{ width: value == null ? '0%' : Math.max(0, value / max * 100) + '%', background: color }} /></div><strong>{value == null ? '—' : money(value)}</strong></div>
}
function MiniRing({ percent, label }: { percent: number | null; label: string }) {
  return <div className="studio-mini-ring" style={{ '--progress': Math.min(100, Math.max(0, percent ?? 0)) + '%' } as CSSProperties} role="img" aria-label={'Bills marked paid: ' + label}><span>{label}</span></div>
}
function Progress({ percent, label }: { percent: number | null; label: string }) {
  return <div className="studio-progress-wrap"><div className="studio-progress-label"><span>{label}</span><strong>{percent == null ? 'No targets yet' : Math.round(percent) + '%'}</strong></div><div className="studio-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent == null ? undefined : Math.min(100, Math.max(0, percent))}><div style={{ width: Math.min(100, Math.max(0, percent ?? 0)) + '%' }} /></div></div>
}
