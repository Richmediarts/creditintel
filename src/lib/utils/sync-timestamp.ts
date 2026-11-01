/** Sync instants are UTC; display explicitly in the household's Eastern zone.
 * A database timestamp without an offset is a legacy UTC value, not local time. */
export function formatSyncedAt(value: string | null | undefined): string {
  if (!value) return ''
  const source = value.trim()
  const qualified = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(source) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(source)
    ? source.replace(' ', 'T') + 'Z' : source
  const date = new Date(qualified)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || ''
  return `${part('month')}/${part('day')}/${part('year')} ${part('hour')}:${part('minute')}${part('dayPeriod').toLowerCase()} ${part('timeZoneName')}`
}
