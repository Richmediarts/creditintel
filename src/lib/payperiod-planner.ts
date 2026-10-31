/**
 * Pay-period planner — the bridge between the budget_* tables and the pure
 * calculation engine in lib/utils/payperiod.ts.
 *
 * Runs as the owner user's budget (see household-db.resolveBudgetUserId) so a
 * spouse sees the shared household plan without duplicating any rows.
 */

import { getDb } from '@/lib/db'
import { getBills, getBudgetCategories, getCreditCards, getReconciliationTransactions } from '@/lib/budget-db'
import { normalizeBillName } from '@/lib/utils/billCategories'
import {
  getOrCreateHousehold, getIncomeSchedules, getReserves,
  type IncomeSchedule, type Household,
} from '@/lib/household-db'
import {
  buildPeriodPlan, PERIOD_LENGTH_DAYS, money,
  type PlanBill, type PlanIncome, type PlanSummary,
} from '@/lib/utils/payperiod'
import {
  reconcilePlanPeriods, reconcileTotals,
  type ReconTx, type SpouseKey, type WindowReconcile, type ReconcileTotals,
} from '@/lib/utils/reconcile'
import { toDateString as clockToDateString } from '@/lib/utils/recurrence'

function isoDate(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined
  if (v instanceof Date) return v.toISOString().split('T')[0]
  const s = String(v)
  const m = s.match(/^\d{4}-\d{2}-\d{2}/)
  return m ? m[0] : undefined
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Parse a local calendar date string (no UTC shifting). */
export function parseLocalDate(dateStr: string): Date | null {
  const m = String(dateStr).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/**
 * Every scheduled pay date for a biweekly/weekly schedule inside the horizon.
 * Monthly schedules are spread proportionally per period and flagged with a
 * note because they do not align with 14-day windows.
 */
export function scheduledPayDates(schedule: IncomeSchedule, horizonStart: string, horizonEnd: string): string[] {
  const out: string[] = []
  const start = isoDate(schedule.pay_start_date)
  if (!start) return out
  const first = parseLocalDate(horizonStart)!
  const end = parseLocalDate(horizonEnd)!
  const push = (d: Date) => {
    const s = clockToDateString(d)
    if (d >= first && d <= end) out.push(s)
  }
  if (schedule.frequency === 'weekly') {
    const step = 7
    let d = parseLocalDate(start)!
    while (d <= end) {
      push(d)
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + step)
    }
    return out
  }
  if (schedule.frequency === 'monthly') {
    // Monthly pay: assume same day-of-month. Pay dates inside the horizon.
    let d = parseLocalDate(start)!
    while (d <= end) {
      push(d)
      d = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate())
    }
    return out
  }
  // Default (biweekly): every 14 days from the anchor.
  let d = parseLocalDate(start)!
  while (d <= end) {
    push(d)
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + PERIOD_LENGTH_DAYS)
  }
  return out
}

export interface PayPeriodDashboard extends PlanSummary {
  paydaySource: string
  allowances: { name: string; amount: number; category: string | null }[]
  reserves: {
    id: number
    name: string
    targetAmount: number
    targetDate: string | null
    amountSaved: number
    perPeriod: number
    status: string
    progressPct: number
  }[]
  incomeScheduleWarnings: string[]
}

/**
 * Build the full dashboard for the household, optionally re-anchored to a
 * specific payday the user picked (?payday=YYYY-MM-DD).
 */
export async function getPayPeriodDashboard(
  userId: number,
  opts: { payday?: string; periods?: number } = {}
): Promise<PayPeriodDashboard> {
  const db = getDb()
  const today = todayStr()

  const household: Household = await getOrCreateHousehold(userId)

  // Bank balance: active accounts excluding loans.
  const bankRow = (await db.prepare(
    `SELECT COALESCE(SUM(current_balance), 0) as t FROM budget_bank_accounts
     WHERE user_id = ? AND is_active = 1 AND account_type != 'loan'`
  ).get(userId)) as { t: number }
  const bankBalance = round2(Number(bankRow.t) || 0)

  // Anchor payday: explicit, else earliest active schedule, else last paycheck.
  const schedules = await getIncomeSchedules(userId)
  let anchor: string | null = opts.payday || null
  let paydaySource = 'chosen'
  if (!anchor && schedules.length > 0) {
    const dates = schedules
      .map((s) => isoDate(s.pay_start_date))
      .filter((d): d is string => !!d)
      .sort()
    if (dates.length > 0) {
      // Use the earliest pay date at or after today, else the last one.
      const upcoming = dates.find((d) => d >= today) ?? dates[dates.length - 1]
      anchor = upcoming
      paydaySource = 'income schedule'
    }
  }
  if (!anchor) {
    const row = (await db.prepare(
      `SELECT pay_date, check_date FROM budget_paychecks WHERE user_id = ?
       ORDER BY check_date DESC NULLS LAST, pay_date DESC NULLS LAST LIMIT 1`
    ).get(userId)) as { pay_date: string | null; check_date: string | null } | undefined
    anchor = isoDate(row?.check_date) || isoDate(row?.pay_date) || null
    if (anchor) paydaySource = 'last paycheck'
  }
  if (!anchor) {
    // Default anchor: this week's most recent Sunday so there is always a plan.
    const d = new Date()
    d.setDate(d.getDate() - d.getDay())
    anchor = clockToDateString(d)
    paydaySource = 'default anchor'
  }

  const horizonEnd = addDays(anchor, PERIOD_LENGTH_DAYS * 12)

  // ======================================================================
  // Income events: one entry per scheduled pay date per spouse. Income that
  // already landed (payDate <= today) is flagged received — it is inside the
  // bank balance and will NOT be added again.
  // ======================================================================
  const incomes: PlanIncome[] = []
  const incomeScheduleWarnings: string[] = []
  for (const schedule of schedules) {
    const payDates = scheduledPayDates(schedule, anchor, horizonEnd)
    if (payDates.length === 0) {
      incomeScheduleWarnings.push(
        `${schedule.name} (${schedule.spouse}) has no start date yet — it is not contributing expected income.`
      )
      continue
    }
    if (schedule.frequency === 'monthly') {
      incomeScheduleWarnings.push(
        `${schedule.name} pays monthly — its amount is shown in the period containing the pay day.`
      )
    }
    for (const payDate of payDates) {
      incomes.push({
        spouse: schedule.spouse,
        netAmount: Math.max(0, Number(schedule.net_amount) || 0),
        label: schedule.name,
        payDate,
        received: payDate <= today,
      })
    }
  }

  // ======================================================================
  // Bills → PlanBill. Unknown amounts are mapped with status 'missing' so
  // the planner excludes them instead of silently counting a zero.
  // ======================================================================
  const bills = await getBills(userId)
  const categories = await getBudgetCategories(userId)
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const cards = await getCreditCards(userId)
  const cardNames = new Set(cards.map((c) => c.name.toLowerCase()))

  const planBills: PlanBill[] = bills.map((b) => {
    const amountRaw = Number(b.amount)
    const amountStatus = (b.amount_status || 'confirmed') || 'confirmed'
    const dueStatus = (b.due_date_status || 'confirmed') || 'confirmed'
    const catName = b.category_id ? categoryName.get(b.category_id) || null : null
    const isCardPayment = !!b.credit_card_id || cardNames.has((b.payee_name || '').toLowerCase())
    const catIsDebt = !!catName && /credit card|debt|loan|collection/i.test(catName)
    return {
      id: b.id,
      name: b.payee_name || 'Unnamed bill',
      amount: amountStatus === 'missing' ? null : (Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : null),
      amountStatus: amountStatus === 'missing' || !(amountRaw > 0) ? 'missing' : (amountStatus as PlanBill['amountStatus']),
      dueDate: isoDate(b.due_date) || null,
      dueDateStatus: isoDate(b.due_date) ? (dueStatus as PlanBill['dueDateStatus']) : 'missing',
      plannedPaymentDate: isoDate(b.planned_payment_date) || null,
      owner: (b.owner || 'me') as PlanBill['owner'],
      paymentAccount: b.account || null,
      recurrence: b.recurrence_type || '',
      isPaid: !!b.is_paid,
      paidDate: isoDate(b.paid_date) || null,
      paidAmount: Number(b.paid_amount) || 0,
      category: catName,
      isDebtPayment: isCardPayment || catIsDebt,
      isExtraDebtPayment: false,
    }
  })

  // ======================================================================
  // Allowances: spending categories with limits convert monthly → per period.
  // Debt categories are excluded, name duplicates are collapsed, and any
  // category that is really a bill payee ("Mortgage") is skipped so house
  // bills are never counted twice.
  // ======================================================================
  const billNames = new Set(bills.map((b) => normalizeBillName(b.payee_name)))
  const seenAllowances = new Set<string>()
  const allowanceRows = categories.filter((c) => {
    const amount = Number(c.monthly_limit) || 0
    if (amount <= 0) return false
    if (/credit card|debt|loan|collection|mortgage|rent|tuition|nelnet|insurance/i.test(c.name)) return false
    // A category that shares its name with an actual payee is a bill, not a
    // flexible spending allowance.
    for (const bn of billNames) {
      if (!bn) continue
      const cn = normalizeBillName(c.name)
      if (cn && (bn === cn || bn.includes(cn) || cn.includes(bn))) return false
    }
    // Collapse duplicate category names.
    const key = normalizeBillName(c.name)
    if (seenAllowances.has(key)) return false
    seenAllowances.add(key)
    return true
  })
  const allowances = allowanceRows.map((c) => ({
    name: c.name,
    amount: round2((Number(c.monthly_limit) || 0) * (PERIOD_LENGTH_DAYS / 30.4375)),
    category: c.name,
  }))

  // ======================================================================
  // Reserves: multi-paycheck saving toward larger future bills.
  // ======================================================================
  const reserveRows = await getReserves(userId)
  const reserves = reserveRows.map((r) => ({
    id: r.id,
    name: r.name,
    targetAmount: Number(r.target_amount) || 0,
    targetDate: isoDate(r.target_date) || null,
    amountSaved: Number(r.amount_saved) || 0,
    perPeriod: Number(r.per_period) || 0,
    status: r.status,
    progressPct: (Number(r.target_amount) || 0) > 0
      ? Math.min(100, Math.round(((Number(r.amount_saved) || 0) / (Number(r.target_amount) || 0)) * 100))
      : 0,
  }))

  // ======================================================================
  // Minimum debt payments: credit-card minimums the household must plan for
  // each period. Cards that already have an unpaid card bill (fuzzy name
  // match, anywhere in the horizon) are ALREADY counted inside billsTotal in
  // the period that bill lands, so they are excluded here — the estimate
  // only covers cards with no planned card bill. Loan/school-debt bills are
  // likewise counted in billsTotal where they land, never here.
  // ======================================================================
  const unpaidDebtBills = planBills.filter(
    (b) => !b.isPaid && b.isDebtPayment && b.amountStatus !== 'missing' && !!b.amount
  )
  let estimatedMinimumDebt = 0
  for (const card of cards) {
    const key = normalizeBillName(card.name)
    const hasBill = unpaidDebtBills.some((b) => {
      const bn = normalizeBillName(b.name)
      return bn && (bn === key || bn.includes(key) || key.includes(bn))
    })
    if (hasBill) continue
    const balance = Math.max(0, Number(card.current_balance) || 0)
    if (balance > 0) {
      estimatedMinimumDebt += Math.max(25, balance * 0.02) * (PERIOD_LENGTH_DAYS / 30.4375)
    }
  }
  const minimumDebtPayments = round2(estimatedMinimumDebt)
  const extraDebtPayment = 0 // planned extra payoff is entered as bills (payee "Extra Debt Payoff")

  const summary = buildPeriodPlan({
    bankBalance,
    anchoredPayday: anchor,
    periods: opts.periods ?? 6,
    startFromIndex: Math.max(0, periodIndex(anchor, today)),
    incomes,
    bills: planBills,
    allowances,
    reserves,
    unconfirmedReserve: Number(household.unconfirmed_reserve) || 0,
    cushionTarget: Number(household.cushion_target) || 0,
    minimumDebtPayments,
    extraDebtPayment,
    today,
  })

  return {
    ...summary,
    paydaySource,
    allowances,
    reserves,
    incomeScheduleWarnings,
  }
}

function periodIndex(anchor: string, today: string): number {
  const a = parseLocalDate(anchor)!
  const t = parseLocalDate(today)
  if (!a || !t) return 0
  return Math.max(0, Math.floor(Math.round((t.getTime() - a.getTime()) / 86400000) / PERIOD_LENGTH_DAYS))
}

function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr)
  if (!d) return dateStr
  d.setDate(d.getDate() + days)
  return clockToDateString(d)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export { money }

// ---------------------------------------------------------------------------
// Pay-period reconciliation: planned vs actual using budget_transactions.
// Reuses the dashboard's anchor + period windows so the "actual" columns land
// in exactly the same windows the plan shows.
// ---------------------------------------------------------------------------

export interface PayPeriodReconciliation {
  anchoredPayday: string
  currentPeriodIndex: number
  windows: WindowReconcile[]
  totals: ReconcileTotals
  /** Transactions skipped because their account no longer exists locally. */
  skippedUnknownAccount: number
  rules: string[]
}

export async function getPayPeriodReconciliation(
  userId: number,
  opts: { payday?: string; periods?: number } = {}
): Promise<PayPeriodReconciliation> {
  const dashboard = await getPayPeriodDashboard(userId, opts)
  const plans = dashboard.periods
  if (plans.length === 0) {
    return {
      anchoredPayday: dashboard.anchoredPayday,
      currentPeriodIndex: dashboard.currentPeriodIndex,
      windows: [],
      totals: {
        planned: 0, spendingActual: 0, incomeActual: 0, cardPayments: 0,
        transfersOut: 0, transfersIn: 0, cardCredits: 0,
        uncategorizedSpendingCount: 0, delta: 0,
      },
      skippedUnknownAccount: 0,
      rules: [],
    }
  }
  const first = plans[0].period
  const last = plans[plans.length - 1].period
  const rows = await getReconciliationTransactions(userId, first.start, last.end)
  const skippedUnknownAccount = rows.filter(r => !r.accountName || !r.accountKind).length
  const cards = await getCreditCards(userId)
  const cardNames = cards
    .map((c) => normalizeBillName(c.name))
    .filter((n) => !!n)

  const reconTxs: ReconTx[] = rows.filter(r => r.accountName && r.accountKind).map((r) => ({
    id: r.id,
    date: r.date,
    description: r.description,
    amount: r.amount,
    category: r.category,
    categoryDetail: r.categoryDetail,
    accountKind: r.accountKind!,
    accountName: r.accountName!,
    accountOwner: (r.accountOwner as SpouseKey) || null,
  }))

  const windows = reconcilePlanPeriods(
    plans.map((p) => ({
      index: p.period.index,
      start: p.period.start,
      end: p.period.end,
      totalOutgoing: p.totalOutgoing,
      expectedTotal: p.incoming.expectedTotal,
      receivedTotal: p.incoming.receivedTotal,
    })),
    reconTxs,
    cardNames
  )

  return {
    anchoredPayday: dashboard.anchoredPayday,
    currentPeriodIndex: dashboard.currentPeriodIndex,
    windows,
    totals: reconcileTotals(windows),
    skippedUnknownAccount,
    rules: [
      'Credit-card purchases count once, when the card is charged.',
      'The later card payment in the bank stream is cash leaving the bank — shown separately, never spending again.',
      'Transfers between your own accounts are neither income nor spending.',
      'Uncategorized spending is still counted, and flagged until it is named.',
    ],
  }
}
