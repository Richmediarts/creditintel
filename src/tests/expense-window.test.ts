import { describe, expect, it } from 'vitest'
import { expenseWindowForPeriod, inExpenseWindow } from '@/lib/utils/expense-window'
import { assignBillsToPeriod, buildPeriodPlan, generatePeriods, type PlanBill } from '@/lib/utils/payperiod'
const bill = (id: number, date: string, extra: Partial<PlanBill> = {}): PlanBill => ({
  id, name: 'Bill ' + id, amount: 100, amountStatus: 'confirmed', dueDate: date,
  dueDateStatus: 'confirmed', owner: 'me', isPaid: false, ...extra,
})
describe('early expense cutoff', () => {
  it('ends Nov 13–26 expenses on Nov 25 and hands Nov 26 to the next period', () => {
    expect(expenseWindowForPeriod('2026-11-13', '2026-11-26')).toEqual({ start: '2026-11-12', end: '2026-11-25' })
    expect(inExpenseWindow('2026-11-25', '2026-11-13', '2026-11-26')).toBe(true)
    expect(inExpenseWindow('2026-11-26', '2026-11-13', '2026-11-26')).toBe(false)
    expect(inExpenseWindow('2026-11-26', '2026-11-27', '2026-12-10')).toBe(true)
  })
  it('uses planned dates before due dates without changing the underlying bill', () => {
    const bills = [bill(1, '2026-11-26', { plannedPaymentDate: '2026-11-25' })]
    expect(assignBillsToPeriod(bills, '2026-11-13', '2026-11-26', '2026-11-15')).toHaveLength(1)
    expect(bills[0].dueDate).toBe('2026-11-26')
  })
  it('assigns boundary bills once and carries their cost to the next period', () => {
    const bills = [bill(1, '2026-11-25'), bill(2, '2026-11-26')]
    const result = buildPeriodPlan({ anchoredPayday: '2026-11-13', periods: 2, today: '2026-11-15', bankBalance: 500, bills, incomes: [] })
    expect(result.periods[0].bills.map(item => item.bill.id)).toEqual([1])
    expect(result.periods[1].bills.map(item => item.bill.id)).toEqual([2])
    expect(result.periods.map(period => period.billsTotal)).toEqual([100, 100])
    expect(result.periods[1].availableNow).toBe(400)
  })
  it('does not roll a recurring boundary bill past its next assigned period', () => {
    const result = buildPeriodPlan({ anchoredPayday: '2026-11-13', periods: 2, today: '2026-11-15', bankBalance: 500,
      bills: [bill(1, '2026-11-26', { recurrence: 'monthly' })], incomes: [] })
    expect(result.periods[0].bills).toHaveLength(0)
    expect(result.periods[1].bills[0].payDate).toBe('2026-11-26')
  })
  it('uses the same cutoff for paid bills while preserving their payment dates', () => {
    const paid = bill(1, '2026-11-20', { isPaid: true, paidDate: '2026-11-26' })
    expect(assignBillsToPeriod([paid], '2026-11-13', '2026-11-26', '2026-11-27')).toHaveLength(0)
    expect(assignBillsToPeriod([paid], '2026-11-27', '2026-12-10', '2026-11-27')[0].countedAmount).toBe(0)
  })
  it('keeps payday income on its actual date rather than shifting it with expenses', () => {
    const result = buildPeriodPlan({ anchoredPayday: '2026-11-13', periods: 2, today: '2026-11-15', bankBalance: 0,
      bills: [bill(1, '2026-11-26')], incomes: [{ spouse: 'me', netAmount: 500, payDate: '2026-11-26', received: false }] })
    expect(result.periods[0].incoming.expectedTotal).toBe(500)
    expect(result.periods[1].billsTotal).toBe(100)
  })
  it('handles month, year and daylight-saving boundaries with no gaps or overlaps', () => {
    for (const anchor of ['2026-12-25', '2026-02-20', '2026-10-30', '2026-03-06']) {
      const periods = generatePeriods(anchor, 4)
      const first = expenseWindowForPeriod(periods[0].start, periods[0].end)!
      const last = expenseWindowForPeriod(periods[3].start, periods[3].end)!
      const date = new Date(first.start + 'T00:00:00')
      while (date <= new Date(last.end + 'T00:00:00')) {
        const day = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
        expect(periods.filter(period => inExpenseWindow(day, period.start, period.end))).toHaveLength(1)
        date.setDate(date.getDate() + 1)
      }
    }
  })
  it('rejects missing dates', () => {
    expect(inExpenseWindow(null, '2026-11-13', '2026-11-26')).toBe(false)
    expect(expenseWindowForPeriod('invalid', '2026-11-26')).toBeNull()
  })
})
