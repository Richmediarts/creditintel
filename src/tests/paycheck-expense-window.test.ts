import { describe, expect, it } from 'vitest'
import { assignBillsToPeriod, buildPeriodPlan, generatePeriods, type PlanBill } from '@/lib/utils/payperiod'
const bill = (id: number, date: string, extra: Partial<PlanBill> = {}): PlanBill => ({
  id, name: 'Bill ' + id, amount: 100, amountStatus: 'confirmed', dueDate: date,
  dueDateStatus: 'confirmed', owner: 'me', isPaid: false, ...extra,
})
describe('paycheck-funded inclusive expense windows', () => {
  it('covers Nov 13 through Nov 26 with the Nov 13 paycheck', () => {
    const bills = [bill(1, '2026-11-13'), bill(2, '2026-11-26')]
    expect(assignBillsToPeriod(bills, '2026-11-13', '2026-11-26', '2026-11-15').map(item => item.bill.id)).toEqual([1, 2])
  })
  it('excludes the day before the paycheck and starts the next window on Nov 27', () => {
    const bills = [bill(1, '2026-11-12'), bill(2, '2026-11-26'), bill(3, '2026-11-27')]
    expect(assignBillsToPeriod(bills, '2026-11-13', '2026-11-26', '2026-11-15').map(item => item.bill.id)).toEqual([2])
    expect(assignBillsToPeriod(bills, '2026-11-27', '2026-12-10', '2026-11-15').map(item => item.bill.id)).toEqual([3])
  })
  it('counts boundary obligations once and carries the correct remaining cash', () => {
    const result = buildPeriodPlan({ anchoredPayday: '2026-11-13', periods: 2, today: '2026-11-15', bankBalance: 500,
      bills: [bill(1, '2026-11-13'), bill(2, '2026-11-26'), bill(3, '2026-11-27')], incomes: [] })
    expect(result.periods.map(period => period.billsTotal)).toEqual([200, 100])
    expect(result.periods[1].availableNow).toBe(300)
  })
  it('retains a recurring Nov 26 bill in the Nov 13 paycheck window', () => {
    const result = buildPeriodPlan({ anchoredPayday: '2026-11-13', periods: 2, today: '2026-11-15', bankBalance: 500,
      bills: [bill(1, '2026-11-26', { recurrence: 'monthly' })], incomes: [] })
    expect(result.periods[0].bills[0].payDate).toBe('2026-11-26')
    expect(result.periods[1].bills).toHaveLength(0)
  })
  it('preserves planned early payment dates', () => {
    const bills = [bill(1, '2026-11-27', { plannedPaymentDate: '2026-11-25' })]
    expect(assignBillsToPeriod(bills, '2026-11-13', '2026-11-26', '2026-11-15')).toHaveLength(1)
    expect(bills[0].dueDate).toBe('2026-11-27')
  })
  it('keeps paid Nov 26 bills in that same window without counting them as money still owed', () => {
    const bills = [bill(1, '2026-11-20', { isPaid: true, paidDate: '2026-11-26' })]
    expect(assignBillsToPeriod(bills, '2026-11-13', '2026-11-26', '2026-11-27')[0].countedAmount).toBe(0)
    expect(assignBillsToPeriod(bills, '2026-11-27', '2026-12-10', '2026-11-27')).toHaveLength(0)
  })
  it('keeps income and expenses on the same inclusive boundaries', () => {
    const result = buildPeriodPlan({ anchoredPayday: '2026-11-13', periods: 2, today: '2026-11-15', bankBalance: 0,
      bills: [bill(1, '2026-11-26')], incomes: [{ spouse: 'me', netAmount: 500, payDate: '2026-11-26', received: false }] })
    expect(result.periods[0].incoming.expectedTotal).toBe(500)
    expect(result.periods[0].billsTotal).toBe(100)
  })
  it('covers every calendar date exactly once across month, year and DST changes', () => {
    for (const anchor of ['2026-12-25', '2026-02-20', '2026-10-30', '2026-03-06']) {
      const periods = generatePeriods(anchor, 4)
      const day = new Date(periods[0].start + 'T00:00:00')
      while (day <= new Date(periods[3].end + 'T00:00:00')) {
        const date = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0')
        expect(periods.filter(period => assignBillsToPeriod([bill(1, date)], period.start, period.end, anchor).length)).toHaveLength(1)
        day.setDate(day.getDate() + 1)
      }
    }
  })
})
