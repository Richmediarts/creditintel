/**
 * Financial-rule tests for the biweekly pay-period planner.
 *
 * Every invariant the dashboard relies on is asserted here so the money math
 * cannot regress silently:
 *  - period boundaries (payday N .. payday N+13 inclusive)
 *  - carry-over without double-counted balances or income
 *  - unknown amounts are never treated as zero
 *  - received income is inside the balance snapshot; expected pay is not
 *  - split math for mine / wife / shared bills
 */
import { describe, it, expect } from 'vitest'
import {
  generatePeriods, periodIndexForDate, assignBillsToPeriod, buildPeriodPlan,
  countedAmount, splitAmount, rollRecurringDueDate,
  type PlanBill, type PlanIncome,
} from '@/lib/utils/payperiod'

const MONEY = (n: number) => Math.round(n * 100) / 100

function bill(partial: Partial<PlanBill> & { id: number }): PlanBill {
  return {
    ...partial,
    name: partial.name ?? `Bill ${partial.id}`,
    amount: partial.amount ?? 100,
    amountStatus: partial.amountStatus ?? 'confirmed',
    dueDate: partial.dueDate ?? null,
    dueDateStatus: partial.dueDateStatus ?? 'confirmed',
    plannedPaymentDate: partial.plannedPaymentDate ?? null,
    owner: partial.owner ?? 'me',
    isPaid: partial.isPaid ?? false,
  } as PlanBill
}

function income(partial: Partial<PlanIncome> & { netAmount: number; payDate: string }): PlanIncome {
  return {
    spouse: partial.spouse ?? 'me',
    netAmount: partial.netAmount,
    payDate: partial.payDate,
    received: partial.received ?? false,
    label: partial.label,
  }
}

describe('generatePeriods', () => {
  it('creates consecutive 14-day windows', () => {
    const periods = generatePeriods('2026-11-06', 3)
    expect(periods).toHaveLength(3)
    expect(periods[0]).toMatchObject({ start: '2026-11-06', end: '2026-11-19' })
    expect(periods[1]).toMatchObject({ start: '2026-11-20', end: '2026-12-03' })
    expect(periods[2]).toMatchObject({ start: '2026-12-04', end: '2026-12-17' })
  })

  it('runs payday through the day BEFORE the next payday', () => {
    const periods = generatePeriods('2026-11-06', 2)
    expect(periods[1].start).toBe('2026-11-20')
    expect(periods[1].index).toBe(1)
  })

  it('keeps a 13-day gap from period start to its end (14 days inclusive)', () => {
    for (const p of generatePeriods('2026-11-06', 5)) {
      const s = new Date(p.start)
      const e = new Date(p.end)
      expect(Math.round((e.getTime() - s.getTime()) / 86400000)).toBe(13)
    }
  })
})

describe('periodIndexForDate', () => {
  it('places the payday in period 0 and payday+13 in the same period', () => {
    expect(periodIndexForDate('2026-11-06', '2026-11-06')).toBe(0)
    expect(periodIndexForDate('2026-11-06', '2026-11-19')).toBe(0)
    expect(periodIndexForDate('2026-11-06', '2026-11-20')).toBe(1)
  })
  it('returns -1 before the anchor', () => {
    expect(periodIndexForDate('2026-11-06', '2026-11-05')).toBe(-1)
  })
})

describe('bill assignment and counting', () => {
  it('assigns a bill to the window via planned payment date', () => {
    const bills = [bill({ id: 1, dueDate: '2026-11-25', plannedPaymentDate: '2026-11-10' })]
    const inFirst = assignBillsToPeriod(bills, '2026-11-06', '2026-11-19', '2026-11-06')
    const inSecond = assignBillsToPeriod(bills, '2026-11-20', '2026-12-03', '2026-11-06')
    // The bill is FUNDABLE from the first paycheck even though due in the second.
    expect(inFirst).toHaveLength(1)
    expect(inFirst[0].payDate).toBe('2026-11-10')
    expect(inSecond).toHaveLength(0)
  })

  it('keeps the due date separate: unpaid scheduled bill uses planned date', () => {
    const bills = [bill({ id: 1, dueDate: '2026-11-30', plannedPaymentDate: '2026-11-09' })]
    expect(assignBillsToPeriod(bills, '2026-11-06', '2026-11-19', '2026-11-06')[0].payDate).toBe('2026-11-09')
  })

  it('never counts an unknown amount as money', () => {
    expect(countedAmount(bill({ id: 1, amount: 0, amountStatus: 'missing' }))).toBe(0)
    expect(countedAmount(bill({ id: 2, amount: undefined, amountStatus: 'missing' }))).toBe(0)
    expect(countedAmount(bill({ id: 3, amount: 55.5, amountStatus: 'estimated' }))).toBe(55.5)
  })

  it('rolls recurring bills forward to the first occurrence on/after the cutoff', () => {
    const b = bill({ id: 1, dueDate: '2026-09-01', recurrence: 'monthly', amount: 120 })
    // Nov 1 already passed; the next scheduled occurrence is Dec 1.
    expect(rollRecurringDueDate(b, '2026-11-06')).toBe('2026-12-01')
  })
})

describe('buildPeriodPlan — money invariants', () => {
  const payday = '2026-11-06'
  const bills: PlanBill[] = [
    bill({ id: 1, name: 'Rent', amount: 900, dueDate: '2026-11-10', plannedPaymentDate: '2026-11-10', owner: 'shared' }),
    bill({ id: 2, name: 'Electric', amount: 90, amountStatus: 'estimated', dueDate: '2026-11-12', plannedPaymentDate: '2026-11-12', owner: 'wife' }),
    bill({ id: 3, name: 'Surprise plumber', amount: 0, amountStatus: 'missing', dueDate: '2026-11-14', plannedPaymentDate: '2026-11-14', owner: 'me' }),
    bill({ id: 4, name: 'Car insurance', amount: 150, dueDate: '2026-11-28', plannedPaymentDate: '2026-11-28', owner: 'shared' }),
    bill({ id: 5, name: 'Water', amount: 40, dueDate: null, amountStatus: 'estimated', owner: 'me' }), // no due date
  ]

  const incomes: PlanIncome[] = [
    income({ spouse: 'me', netAmount: 1200, payDate: '2026-11-06', received: true }),
    income({ spouse: 'wife', netAmount: 800, payDate: '2026-11-13', received: false }),
    income({ spouse: 'me', netAmount: 1200, payDate: '2026-11-20', received: false }),
    income({ spouse: 'wife', netAmount: 800, payDate: '2026-11-27', received: false }),
  ]

  const result = buildPeriodPlan({
    bankBalance: 600,
    anchoredPayday: payday,
    periods: 3,
    startFromIndex: 0,
    incomes,
    bills,
    allowances: [{ name: 'Groceries', amount: 175 }, { name: 'Fuel', amount: 60 }],
    reserves: [{ name: 'Property tax', targetAmount: 900, amountSaved: 300, perPeriod: 85 }],
    unconfirmedReserve: 100,
    minimumDebtPayments: 120,
    today: '2026-11-06',
  })

  it('excludes unknown amounts from totals but reports the count', () => {
    expect(result.periods[0].unknownCount).toBe(1)
    expect(result.periods[0].billsTotal).toBe(900 + 90)
    expect(result.periods[0].confirmedBillsTotal).toBe(900)
    expect(result.periods[0].estimatedBillsTotal).toBe(90)
  })

  it('does NOT double-count received income (already in the balance)', () => {
    const period = result.periods[0]
    // received my paycheck: informational only
    expect(period.incoming.receivedTotal).toBe(1200)
    expect(period.incoming.expectedTotal).toBe(800)
    // available now = bank balance only
    expect(period.availableNow).toBe(600)
  })

  it('computes remaining to assign with a transparent explanation', () => {
    const period = result.periods[0]
    const outgoing = 990 + 235 + 85 + 120
    expect(MONEY(period.totalOutgoing)).toBe(MONEY(outgoing))
    expect(period.remainingToAssign).toBe(600 - outgoing)
    expect(period.availableToSpend).toBe(600 - outgoing - 100)
    expect(period.explanation).toContain('Carried from the previous period: $600.00')
    expect(period.explanation).toContain('not added a second time')
    expect(period.explanation).toContain('unconfirmed-expense reserve')
  })

  it('carries the projected ending balance into the next period exactly once', () => {
    const p0 = result.periods[0]
    const p1 = result.periods[1]
    expect(p1.carriedOver).toBe(p0.endingBalance)
    expect(p0.endingBalance).toBe(p0.remainingToAssign + 800)
    // no income is double-added: p1 start + p1 income = p1 remaining + outgoings
    const p1Out = 150 + 235 + 85 + 120
    expect(MONEY(p1.remainingToAssign + p1Out)).toBe(MONEY(p0.endingBalance))
  })

  it('flags shortfalls when outgoings exceed cash plus expected pay', () => {
    const shortPlan = buildPeriodPlan({
      bankBalance: 100,
      anchoredPayday: payday,
      periods: 1,
      incomes: [],
      bills: [bill({ id: 99, amount: 900, dueDate: '2026-11-10', plannedPaymentDate: '2026-11-10' })],
      today: '2026-11-06',
    })
    expect(shortPlan.periods[0].shortfall).toBe(800)
    expect(shortPlan.periods[0].remainingToAssign).toBe(-800)
  })

  it('keeps missing due dates out of every window and reports them', () => {
    expect(result.missingDueDateCount).toBe(1)
    const anywhere = result.periods.find((p) => p.bills.some((a) => a.bill.id === 5))
    expect(anywhere).toBeUndefined()
  })
})

describe('buildPeriodPlan — boundary conditions', () => {
  it('a bill due ON the next payday belongs to the NEXT period', () => {
    const bills = [
      bill({ id: 1, amount: 100, dueDate: '2026-11-06', plannedPaymentDate: '2026-11-06' }),
      bill({ id: 2, amount: 200, dueDate: '2026-11-20', plannedPaymentDate: '2026-11-20' }),
    ]
    const res = buildPeriodPlan({
      bankBalance: 1000,
      anchoredPayday: '2026-11-06',
      periods: 2,
      incomes: [],
      bills,
      today: '2026-11-06',
    })
    expect(res.periods[0].bills.map((a) => a.bill.id)).toEqual([1])
    expect(res.periods[1].bills.map((a) => a.bill.id)).toEqual([2])
    expect(res.periods[0].billsTotal).toBe(100)
    expect(res.periods[1].billsTotal).toBe(200)
  })

  it('historical periods are skipped when seeding the balance', () => {
    const res = buildPeriodPlan({
      bankBalance: 500,
      anchoredPayday: '2026-10-09',
      periods: 2,
      startFromIndex: 1,
      incomes: [],
      bills: [],
      today: '2026-10-23',
    })
    expect(res.periods[0].historical).toBe(true)
    expect(res.periods[1].carriedOver).toBe(500)
  })
})

describe('splitAmount (shared household)', () => {
  it('assigns full amount to its owner', () => {
    expect(splitAmount({ amount: 100, owner: 'me' })).toEqual({ me: 100, wife: 0 })
    expect(splitAmount({ amount: 100, owner: 'wife' })).toEqual({ me: 0, wife: 100 })
  })
  it('splits shared bills 50/50 by default', () => {
    expect(splitAmount({ amount: 101, owner: 'shared' })).toEqual({ me: 50.5, wife: 50.5 })
  })
  it('supports custom percentages', () => {
    expect(splitAmount({ amount: 100, owner: 'shared', sharePercent: 70 })).toEqual({ me: 70, wife: 30 })
  })
})
