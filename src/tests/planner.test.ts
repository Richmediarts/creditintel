import { describe, it, expect } from 'vitest'
import { scheduledPayDates, parseLocalDate } from '@/lib/payperiod-planner'

describe('scheduledPayDates', () => {
  it('generates consecutive 14-day pay dates for biweekly', () => {
    const s = scheduledPayDates(
      { pay_start_date: '2026-11-06', frequency: 'biweekly' } as never,
      '2026-11-01',
      '2026-12-17'
    )
    expect(s).toEqual(['2026-11-06', '2026-11-20', '2026-12-04'])
  })

  it('generates weekly pay dates', () => {
    const s = scheduledPayDates(
      { pay_start_date: '2026-11-06', frequency: 'weekly' } as never,
      '2026-11-01',
      '2026-11-30'
    )
    expect(s).toEqual(['2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27'])
  })

  it('returns monthly pay dates inside the horizon', () => {
    const s = scheduledPayDates(
      { pay_start_date: '2026-10-05', frequency: 'monthly' } as never,
      '2026-10-01',
      '2026-11-19'
    )
    expect(s).toEqual(['2026-10-05', '2026-11-05'])
  })

  it('handles a schedule whose anchor is before the horizon start', () => {
    const s = scheduledPayDates(
      { pay_start_date: '2026-10-09', frequency: 'biweekly' } as never,
      '2026-11-06',
      '2026-11-19'
    )
    // Oct 9 / Oct 23 dates fall outside the horizon; Nov 6 (the horizon start
    // itself, on the 28th-day anchor) is included.
    expect(s).toEqual(['2026-11-06'])
  })

  it('returns nothing without a start date', () => {
    expect(scheduledPayDates({ pay_start_date: null, frequency: 'biweekly' } as never, '2026-11-01', '2026-12-01')).toEqual([])
  })
})

describe('parseLocalDate', () => {
  it('parses calendar dates without UTC shifting', () => {
    const d = parseLocalDate('2026-09-15')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8)
    expect(d.getDate()).toBe(15)
  })
})
