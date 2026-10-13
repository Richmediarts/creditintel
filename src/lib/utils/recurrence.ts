/**
 * Recurring bill date math.
 *
 * When a recurring bill is marked paid, its due date rolls forward by the
 * bill's own recurrence instead of a blanket one month. Every function clamps
 * to the end of the target month so a bill due on the 31st does not skip a
 * month in February.
 */

export type Recurrence =
  | 'weekly'
  | 'biweekly'
  | 'semimonthly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly'
  | ''

export interface RecurrenceOption {
  value: Recurrence
  label: string
  short: string
}

export const RECURRENCE_OPTIONS: RecurrenceOption[] = [
  { value: '', label: 'One-time only', short: 'One-time' },
  { value: 'weekly', label: 'Every week', short: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks', short: 'Bi-weekly' },
  { value: 'semimonthly', label: 'Twice a month', short: 'Semi-monthly' },
  { value: 'monthly', label: 'Every month', short: 'Monthly' },
  { value: 'quarterly', label: 'Every 3 months', short: 'Quarterly' },
  { value: 'semiannual', label: 'Every 6 months', short: 'Semi-annual' },
  { value: 'yearly', label: 'Every year', short: 'Yearly' },
]

const RECURRENCE_MAP = new Map(RECURRENCE_OPTIONS.map(o => [o.value, o]))

export function recurrenceLabel(value?: string | null): string {
  return RECURRENCE_MAP.get((value || '') as Recurrence)?.short ?? 'One-time'
}

/**
 * Parse a date as a *local* calendar date.
 *
 * `new Date('2026-09-15')` parses as UTC midnight, which renders as the 14th
 * for anyone west of Greenwich. Splitting the parts keeps every calculation on
 * the calendar day the user actually entered.
 */
export function parseDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null
  const trimmed = String(dateStr).trim()

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const y = parseInt(iso[1], 10)
    const m = parseInt(iso[2], 10)
    const d = parseInt(iso[3], 10)
    const dt = new Date(y, m - 1, d)
    return isNaN(dt.getTime()) ? null : dt
  }

  // Fall back for any other recognised format (e.g. "Sep 1, 2026").
  const d = new Date(trimmed)
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function toDateString(d: Date): string {
  // Use local components so a UTC conversion cannot shift the day.
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Advance a date by one recurrence step.
 *
 * `from` is the current due date. When a bill is paid late we advance from the
 * original due date rather than from today, so a bill paid 20 days late still
 * lands on the next scheduled date and not one that skips ahead.
 */
export function nextDueDate(
  dueDate: string | null | undefined,
  recurrence: Recurrence | string | null | undefined
): string | null {
  const start = parseDate(dueDate)
  if (!start) return null

  const rec = ((recurrence || '') as Recurrence)

  switch (rec) {
    case 'weekly':
    case 'biweekly': {
      const days = rec === 'weekly' ? 7 : 14
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      d.setDate(d.getDate() + days)
      return toDateString(d)
    }
    case 'semimonthly': {
      // Semimonthly runs on the 1st and the 15th. A bill due before the 15th
      // rolls to the 15th of the same month; anything on or after the 15th rolls
      // to the 1st of the next month.
      if (start.getDate() < 15) {
        return toDateString(new Date(start.getFullYear(), start.getMonth(), 15))
      }
      return toDateString(new Date(start.getFullYear(), start.getMonth() + 1, 1))
    }
    case 'monthly':
    case 'quarterly':
    case 'semiannual':
    case 'yearly': {
      const months =
        rec === 'monthly' ? 1 : rec === 'quarterly' ? 3 : rec === 'semiannual' ? 6 : 12
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      const targetMonth = d.getMonth() + months
      // Clamp so Jan 31 + 1 month lands on Feb 28, not Mar 3.
      const lastDay = new Date(d.getFullYear(), targetMonth + 1, 0).getDate()
      d.setDate(Math.min(d.getDate(), lastDay))
      d.setMonth(targetMonth)
      return toDateString(d)
    }
    default:
      return null
  }
}

/**
 * Advance a date by N recurrence steps, useful when a bill has been skipped
 * several cycles.
 */
export function advanceDueDate(
  dueDate: string | null | undefined,
  recurrence: Recurrence | string | null | undefined,
  steps = 1
): string | null {
  let current = dueDate ?? null
  for (let i = 0; i < Math.max(1, steps); i++) {
    const next = nextDueDate(current, recurrence)
    if (!next) return current
    current = next
  }
  return current
}

/** How many days until a date. Negative means overdue. */
export function daysUntil(dateStr: string | null | undefined, from = new Date()): number | null {
  const d = parseDate(dateStr)
  if (!d) return null
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.round((d.getTime() - a.getTime()) / 86400000)
}

/**
 * The pay window a bill falls in.
 *
 * `anchorDate` is the most recent paycheck date. Paychecks run on a 14-day
 * cycle, so window N covers the 14 days ending on payday `anchor + 14*N`.
 */
export interface PayWindow {
  index: number
  start: Date
  end: Date
  label: string
}

export function payWindowFor(
  dueDate: string | null | undefined,
  anchorDate: string | null | undefined
): { windowIndex: number; windowStart: Date; windowEnd: Date } | null {
  const due = parseDate(dueDate)
  const anchor = parseDate(anchorDate)
  if (!due || !anchor) return null

  const anchorDay = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())

  const diffDays = Math.round((due.getTime() - anchorDay.getTime()) / 86400000)

  // Window N satisfies 14*(N-1) < diff <= 14*N, so N = ceil(diff / 14).
  const windowIndex = Math.ceil(diffDays / 14)

  const windowEnd = new Date(anchorDay.getTime())
  windowEnd.setDate(windowEnd.getDate() + windowIndex * 14)

  const windowStart = new Date(windowEnd.getTime())
  windowStart.setDate(windowStart.getDate() - 13)

  return { windowIndex, windowStart, windowEnd }
}

/** Format a date the way the Bills page does. */
export function formatDueDate(dateStr: string): string {
  const d = parseDate(dateStr)
  if (!d) return dateStr || '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
