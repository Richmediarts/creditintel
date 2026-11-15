import { parseDate, toDateString } from '@/lib/utils/recurrence'

/**
 * Expense grouping hands off one day before the labelled pay period ends.
 * Shifting both endpoints preserves consecutive 14-day expense windows:
 * Nov 13–26 funds Nov 12–25; Nov 27–Dec 10 funds Nov 26–Dec 9.
 * Income and transaction dates retain their actual pay-period boundaries.
 */
export function expenseWindowForPeriod(start: string, end: string): { start: string; end: string } | null {
  const first = parseDate(start)
  const last = parseDate(end)
  if (!first || !last || first > last) return null
  first.setDate(first.getDate() - 1)
  last.setDate(last.getDate() - 1)
  return { start: toDateString(first), end: toDateString(last) }
}

export function inExpenseWindow(date: string | null | undefined, start: string, end: string): boolean {
  const window = expenseWindowForPeriod(start, end)
  const parsed = parseDate(date)
  if (!window || !parsed) return false
  const day = toDateString(parsed)
  return day >= window.start && day <= window.end
}
