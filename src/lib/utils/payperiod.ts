/**
 * Biweekly pay-period planning math.
 *
 * These functions are pure so the financial rules can be tested without a
 * database. The pay-period dashboard (src/lib/payperiod-planner.ts) feeds real
 * rows from budget_* tables into `buildPeriodPlan` and renders the result.
 *
 * Core invariants (money can never be counted twice):
 *  - A pay period runs payday N (inclusive) through payday N+13 (inclusive);
 *    the next period starts on payday N+14.
 *  - The FIRST live period's starting cash = today's real bank balance.
 *    Later periods carry the previous period's PROJECTED ending balance.
 *  - Income already received (pay date ≤ today) is INSIDE today's bank
 *    balance, so it is shown for transparency but never added to "available
 *    now" again. Only expected future pay is added, and only to projections.
 *  - A period's ending balance feeds the next period's starting balance.
 *  - An unknown amount is NEVER treated as zero. Unknown bills are excluded
 *    from every money total and reported separately instead.
 *  - "Remaining after known bills" and "available to spend" are distinct: the
 *    latter also removes the household's unconfirmed-expense reserve.
 */

import { parseDate, toDateString, advanceDueDate } from '@/lib/utils/recurrence'

export const PERIOD_LENGTH_DAYS = 14

export type SpouseKey = 'me' | 'wife' | 'shared'
export type DetailStatus = 'confirmed' | 'estimated' | 'missing'

/** A household bill the planner can see. */
export interface PlanBill {
  id: number
  name: string
  /** Confirmed/estimated amount. Undefined or null when unknown. */
  amount?: number | null
  amountStatus: DetailStatus
  dueDate?: string | null
  dueDateStatus: DetailStatus
  /** The date we actually plan to pay — may be earlier than due. */
  plannedPaymentDate?: string | null
  owner: SpouseKey
  /** Which funding account the bill is paid from, if specified. */
  paymentAccount?: string | null
  recurrence?: string
  isPaid: boolean
  paidDate?: string | null
  /** Settled so far via partial payments; the remainder is what still shows. */
  paidAmount?: number
  category?: string | null
  /** True when this bill IS a credit/debt payment (credit cards, loans). */
  isDebtPayment?: boolean
  /** Card payment counts toward minimums; extra ones are planned payoff. */
  isExtraDebtPayment?: boolean
}

/** A pay event inside one period, per spouse. */
export interface PlanIncome {
  spouse: SpouseKey
  netAmount: number
  label?: string
  /** The single scheduled/paid date this event belongs to. */
  payDate: string
  /** true when the money has already landed and is inside the balance. */
  received: boolean
}

/** Money the household deliberately sets aside each period. */
export interface PlanAllowance {
  name: string
  amount: number
  spouse?: SpouseKey
  category?: string | null
}

/** Saving across multiple paychecks toward a larger future bill. */
export interface PlanReserve {
  id?: number
  name: string
  targetAmount: number
  targetDate?: string | null
  amountSaved: number
  perPeriod: number
  status?: DetailStatus
  billId?: number | null
}

/** One generated pay period window. */
export interface Period {
  index: number
  start: string
  end: string
  label: string
}

/** A bill assigned to a period, with the date used for assignment. */
export interface AssignedBill {
  bill: PlanBill
  /** plannedPaymentDate ?? dueDate — effective day the bill needs money. */
  payDate: string
  /** Amount counted in period totals (confirmed/estimated, never unknown). */
  countedAmount: number
  overdue: boolean
}

export interface IncomingIncome {
  income: PlanIncome[]
  receivedTotal: number
  expectedTotal: number
}

export interface PeriodPlan {
  period: Period
  /** A period whose window started before today: balance seeding is skipped. */
  historical?: boolean
  bills: AssignedBill[]
  incoming: IncomingIncome
  billsTotal: number
  confirmedBillsTotal: number
  estimatedBillsTotal: number
  unknownCount: number
  overdueBills: AssignedBill[]
  allowancesTotal: number
  reservesTotal: number
  minimumDebtPayments: number
  extraDebtPlanned: number
  totalOutgoing: number
  startBalance: number
  endingBalance: number
  /** Projected cash IF the expected income actually lands. */
  projectedEndingBalance: number
  /** Cash from the prior period still available at the period's start. */
  carriedOver: number
  /** carriedOver — cash touchable today (expected pay NOT included). */
  availableNow: number
  /** availableNow − known bills − allowances − reserves − debt payments. */
  remainingToAssign: number
  /** remainingToAssign − unconfirmed-expense reserve (available-to-spend). */
  availableToSpend: number
  /** Known outgoings + cushion vs projected cash. 0 when healthy. */
  shortfall: number
  /** True when projected ending balance falls below the cushion target. */
  belowCushion: boolean
  belowCushionBy: number
  explanation: string
}

export interface PlanSummary {
  today: string
  anchoredPayday: string
  currentPeriodIndex: number
  periods: PeriodPlan[]
  totalBankBalance: number
  unconfirmedReserve: number
  cushionTarget: number
  unknownAmountCount: number
  missingDueDateCount: number
  confirmedUnpaidTotal: number
  estimatedUnpaidTotal: number
  openReserves: PlanReserve[]
  notes: string[]
}

export interface BuildPlanInput {
  /** Money currently in household bank accounts (today). */
  bankBalance: number
  anchoredPayday: string
  /** How many periods to generate going forward. */
  periods?: number
  /** Index of the period that contains today; earlier ones are historical. */
  startFromIndex?: number
  incomes: PlanIncome[]
  bills: PlanBill[]
  allowances?: PlanAllowance[]
  reserves?: PlanReserve[]
  /** Amount set aside each period for bills we haven't quantified yet. */
  unconfirmedReserve?: number
  cushionTarget?: number
  /** Minimum credit/debt payments planned per period. */
  minimumDebtPayments?: number
  /** Extra debt payoff money planned from this period's leftovers. */
  extraDebtPayment?: number
  today?: string
}

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

/** Generate `count` consecutive 14-day pay periods starting at `payday`. */
export function generatePeriods(payday: string, count: number): Period[] {
  const start = parseDate(payday)
  if (!start) return []
  const periods: Period[] = []
  for (let i = 0; i < count; i++) {
    const begin = new Date(start)
    begin.setDate(begin.getDate() + i * PERIOD_LENGTH_DAYS)
    const end = new Date(begin)
    end.setDate(end.getDate() + PERIOD_LENGTH_DAYS - 1)
    periods.push({
      index: i,
      start: toDateString(begin),
      end: toDateString(end),
      label: `${compactDate(begin)} – ${compactDate(end)}`,
    })
  }
  return periods
}

function compactDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Which period (0-based) contains `dateStr`, or -1 when outside/invalid.
 */
export function periodIndexForDate(payday: string, dateStr: string): number {
  const start = parseDate(payday)
  const d = parseDate(dateStr)
  if (!start || !d) return -1
  const diff = Math.round((d.getTime() - start.getTime()) / 86400000)
  if (diff < 0) return -1
  return Math.floor(diff / PERIOD_LENGTH_DAYS)
}

/** True when the date is inside [start, end] (inclusive, calendar days). */
function inRange(dateStr: string | null | undefined, startDate: string, endDate: string): boolean {
  const d = parseDate(dateStr)
  if (!d) return false
  const s = parseDate(startDate)!
  const e = parseDate(endDate)!
  return d >= s && d <= e
}

/** Treat an absent status as 'confirmed' so the pure helpers never mis-sort. */
function normStatus(bill: { amountStatus?: DetailStatus; amount?: number | null }): DetailStatus {
  return (bill.amountStatus as DetailStatus) ?? 'confirmed'
}

/**
 * Bills assigned to a period: those whose planned payment date (or due date,
 * when there is no plan yet) falls inside the window. Paid bills only appear
 * in the period where they were settled; unpaid ones are the ones needing cash.
 */
export function assignBillsToPeriod(
  bills: PlanBill[],
  startDate: string,
  endDate: string,
  today: string
): AssignedBill[] {
  const out: AssignedBill[] = []
  for (const bill of bills) {
    const payDate = bill.plannedPaymentDate || bill.dueDate || null
    const relevant =
      bill.isPaid && inRange(bill.paidDate || payDate, startDate, endDate)
    const unpaidScheduled = !bill.isPaid && inRange(payDate, startDate, endDate)
    if (!relevant && !unpaidScheduled) continue
    out.push({
      bill,
      payDate: payDate || 'unknown',
      countedAmount: countedAmount(bill),
      overdue: !bill.isPaid && !!payDate && payDate < today,
    })
  }
  return out.sort(sortBills)
}

function sortBills(a: AssignedBill, b: AssignedBill): number {
  if (a.payDate === 'unknown') return 1
  if (b.payDate === 'unknown') return -1
  return a.payDate.localeCompare(b.payDate)
}

/** Amount still owed after partial settlements — unknown stays unknown. */
export function owedAmount(bill: PlanBill): number | null {
  if (bill.amount === null || bill.amount === undefined) return null
  return Math.max(0, Number(bill.amount) - Math.max(0, Number(bill.paidAmount) || 0))
}

/** Unknown amounts are never counted as money — they stay unknown. */
export function countedAmount(bill: PlanBill): number {
  if (bill.isPaid) return 0
  if (bill.amountStatus === 'missing') return 0
  const owed = owedAmount(bill)
  return owed === null ? 0 : Math.max(0, owed)
}

/**
 * Roll a recurring bill forward so its next scheduled occurrence appears in
 * future periods even when the stored due date has already passed.
 */
export function rollRecurringDueDate(bill: PlanBill, throughDate: string): string | null {
  if (!bill.recurrence) return null
  let date = bill.dueDate || null
  if (!date) return null
  let guard = 0
  while (date && date < throughDate && guard < 420) {
    const next = advanceDueDate(date, bill.recurrence)
    if (!next || next === date) break
    date = next
    guard++
  }
  return date
}

export function unknownAmountCount(bills: PlanBill[]): number {
  return bills.filter((b) => !b.isPaid && (b.amountStatus === 'missing' || b.amount == null)).length
}

export function missingDueDateCount(bills: PlanBill[]): number {
  return bills.filter((b) => !b.isPaid && !b.dueDate && !b.plannedPaymentDate).length
}

export function money(n: number): string {
  return '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ---------------------------------------------------------------------------
// Money math
// ---------------------------------------------------------------------------

/**
 * Build the full multi-period plan. Each period carries a plain-language
 * explanation of how "remaining to assign" was derived.
 */
export function buildPeriodPlan(input: BuildPlanInput): PlanSummary {
  const today = input.today || toDateString(new Date())
  const count = input.periods ?? 4
  const periods = generatePeriods(input.anchoredPayday, count)
  const notes: string[] = []
  const unconfirmedReserve = Math.max(0, input.unconfirmedReserve || 0)
  const cushionTarget = Math.max(0, input.cushionTarget || 0)
  const startIndex = Math.max(0, input.startFromIndex ?? 0)

  let startBalance = Math.max(0, input.bankBalance)
  let currentPeriodIndex = -1

  const plans: PeriodPlan[] = []

  for (const period of periods) {
    const historical = period.index < startIndex
    // Roll recurring bills whose stored date is in the past into the first
    // occurrence on/after this window, so they keep appearing onward.
    const rolledBills = input.bills.map((bill) => {
      if (bill.isPaid || !bill.recurrence) return bill
      const pay = bill.plannedPaymentDate || bill.dueDate || null
      if (!pay || pay >= period.start) return bill
      const rolled = rollRecurringDueDate(bill, period.start)
      return rolled && rolled !== pay ? { ...bill, dueDate: rolled } : bill
    })
    const assignments = assignBillsToPeriod(rolledBills, period.start, period.end, today)
    if (periodIndexForDate(input.anchoredPayday, today) === period.index) {
      currentPeriodIndex = period.index
    }

    const unpaid = assignments.filter((a) => !a.bill.isPaid)
    const overdue = unpaid.filter((a) => a.overdue)
    const known = unpaid.filter((a) => normStatus(a.bill) !== 'missing' && a.bill.amount != null)
    const confirmedTotal = known
      .filter((a) => normStatus(a.bill) === 'confirmed')
      .reduce((s, a) => s + a.countedAmount, 0)
    const estimatedTotal = known
      .filter((a) => normStatus(a.bill) === 'estimated')
      .reduce((s, a) => s + a.countedAmount, 0)
    const unknownCount = unpaid.filter(
      (a) => a.bill.amountStatus === 'missing' || a.bill.amount == null
    ).length
    const billsTotal = confirmedTotal + estimatedTotal

    // Income bucketed into this period by its pay date.
    const income = input.incomes
      .filter((i) => inRange(i.payDate, period.start, period.end))
      .sort((a, b) => a.payDate.localeCompare(b.payDate))
    const receivedTotal = income
      .filter((i) => i.received)
      .reduce((s, i) => s + Math.max(0, i.netAmount), 0)
    const expectedTotal = income
      .filter((i) => !i.received)
      .reduce((s, i) => s + Math.max(0, i.netAmount), 0)

    const allowancesTotal = (input.allowances || []).reduce(
      (s, a) => s + Math.max(0, a.amount || 0),
      0
    )
    const reservesTotal = (input.reserves || []).reduce((s, r) => s + Math.max(0, r.perPeriod), 0)
    const minimumDebt = Math.max(0, input.minimumDebtPayments || 0)
    const extraDebt = Math.max(0, input.extraDebtPayment || 0)

    const totalOutgoing = billsTotal + allowancesTotal + reservesTotal + minimumDebt + extraDebt

    // Money in hand: prior carry-over only. Income already received sits
    // inside the bank-balance snapshot, so it is NEVER added again here.
    // A NEGATIVE carry-over means the previous period overspent — the
    // shortfall must be visible in this period, never silently clamped away.
    const carriedOver = historical ? 0 : startBalance
    const availableNow = carriedOver
    const remainingToAssign = availableNow - totalOutgoing
    const availableToSpend = remainingToAssign - unconfirmedReserve
    // Projected WITH expected income (money we do not have in hand yet).
    const projectedEndingBalance = remainingToAssign + expectedTotal
    const endingBalance = projectedEndingBalance
    const shortfall = Math.max(0, totalOutgoing - (availableNow + expectedTotal))
    const belowCushion = cushionTarget > 0 && projectedEndingBalance < cushionTarget
    const belowCushionBy = belowCushion ? cushionTarget - projectedEndingBalance : 0

    const explanation = buildExplanation({
      carriedOver,
      receivedTotal,
      billsTotal,
      allowancesTotal,
      reservesTotal,
      minimumDebt,
      extraDebt,
      unconfirmedReserve,
      remainingToAssign,
      availableToSpend,
      expectedTotal,
      projected: projectedEndingBalance,
      unknownCount,
    })

    plans.push({
      period,
      historical,
      bills: assignments,
      incoming: { income, receivedTotal, expectedTotal },
      billsTotal,
      confirmedBillsTotal: confirmedTotal,
      estimatedBillsTotal: estimatedTotal,
      unknownCount,
      overdueBills: overdue,
      allowancesTotal,
      reservesTotal,
      minimumDebtPayments: minimumDebt,
      extraDebtPlanned: extraDebt,
      totalOutgoing,
      startBalance,
      endingBalance,
      projectedEndingBalance,
      carriedOver,
      availableNow,
      remainingToAssign,
      availableToSpend,
      shortfall,
      belowCushion,
      belowCushionBy,
      explanation,
    })

    if (!historical) startBalance = endingBalance
  }

  const openReserves = (input.reserves || []).filter(
    (r) => r.status !== 'confirmed' || r.amountSaved < r.targetAmount
  )

  const unpaidBills = input.bills.filter(
    (b) => !b.isPaid && (b.plannedPaymentDate || b.dueDate || '9999') >= today
  )
  const confirmedUnpaidTotal = sumStatus(unpaidBills, 'confirmed')
  const estimatedUnpaidTotal = sumStatus(unpaidBills, 'estimated')

  const unknownN = unknownAmountCount(input.bills)
  if (unknownN > 0) {
    notes.push(
      `${unknownN} unpaid bill${unknownN === 1 ? ' has' : 's have'} an unknown amount. ` +
        'They are excluded from every money total until confirmed — keep the unconfirmed reserve for them instead.'
    )
  }
  const missingN = missingDueDateCount(input.bills)
  if (missingN > 0) {
    notes.push(
      `${missingN} unpaid bill${missingN === 1 ? ' needs' : 's need'} a due or planned date ` +
        'before they can be scheduled into a pay period.'
    )
  }
  if (unconfirmedReserve > 0) {
    notes.push(
      `A ${money(unconfirmedReserve)} per-period reserve is held aside for unconfirmed household expenses, ` +
        'so "available to spend" is smaller than "remaining after known bills".'
    )
  }
  if (startIndex > 0) {
    notes.push(
      'Balances are seeded into the period containing today, so earlier windows are shown for reference only.'
    )
  }

  return {
    today,
    anchoredPayday: input.anchoredPayday,
    currentPeriodIndex,
    periods: plans,
    totalBankBalance: Math.max(0, input.bankBalance),
    unconfirmedReserve,
    cushionTarget,
    unknownAmountCount: unknownN,
    missingDueDateCount: missingN,
    confirmedUnpaidTotal,
    estimatedUnpaidTotal,
    openReserves,
    notes,
  }
}

function sumStatus(bills: PlanBill[], status: DetailStatus): number {
  return bills
    .filter((b) => b.amountStatus === status && b.amount != null)
    .reduce((s, b) => s + Math.max(0, Number(b.amount) || 0), 0)
}

interface ExplanationInput {
  carriedOver: number
  receivedTotal: number
  billsTotal: number
  allowancesTotal: number
  reservesTotal: number
  minimumDebt: number
  extraDebt: number
  unconfirmedReserve: number
  remainingToAssign: number
  availableToSpend: number
  expectedTotal: number
  projected: number
  unknownCount: number
}

/**
 * Plain-language walkthrough of the arithmetic so the headline number is
 * never a mystery.
 */
function buildExplanation(x: ExplanationInput): string {
  const parts: string[] = []
  parts.push(`Carried from the previous period: ${money(x.carriedOver)}.`)
  if (x.receivedTotal > 0) {
    parts.push(
      `${money(x.receivedTotal)} of pay already landed this period — it is inside your bank balance and is not added a second time.`
    )
  }
  parts.push(
    `Bills due: ${money(x.billsTotal)}${x.unknownCount > 0 ? ` (${x.unknownCount} unknown amounts not counted)` : ''}, ` +
      `everyday allowances: ${money(x.allowancesTotal)}, ` +
      `future-bill reserves: ${money(x.reservesTotal)}, ` +
      `minimum debt payments: ${money(x.minimumDebt)}` +
      (x.extraDebt ? `, extra debt payoff: ${money(x.extraDebt)}` : '') +
      '.'
  )
  parts.push(`Remaining after known obligations: ${money(x.remainingToAssign)}.`)
  if (x.unconfirmedReserve > 0) {
    parts.push(
      `After the ${money(x.unconfirmedReserve)} unconfirmed-expense reserve, available to spend: ${money(x.availableToSpend)}.`
    )
  }
  if (x.expectedTotal > 0) {
    parts.push(
      `Adding expected pay of ${money(x.expectedTotal)} that arrives by the end of the period projects ${money(x.projected)} — projection, not money in hand.`
    )
  }
  if (x.remainingToAssign < 0) {
    parts.push('⚠ Shortfall: known obligations exceed cash in hand this period.')
  }
  return parts.join(' ')
}

/** Shared-cost split helpers. */
export interface SplitResult {
  me: number
  wife: number
}

export function splitAmount(bill: {
  amount: number
  owner: SpouseKey
  /** Percent of the total owed by "me"; default 50 for shared bills. */
  sharePercent?: number
}): SplitResult {
  const amount = Math.max(0, bill.amount || 0)
  if (bill.owner === 'me') return { me: amount, wife: 0 }
  if (bill.owner === 'wife') return { me: 0, wife: amount }
  const pct = bill.sharePercent == null ? 50 : Math.min(100, Math.max(0, bill.sharePercent))
  const mine = round2(amount * (pct / 100))
  return { me: mine, wife: round2(amount - mine) }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
