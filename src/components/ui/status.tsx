import React from 'react'

export type StatusKey = 'confirmed' | 'estimated' | 'missing' | 'paid' | 'overdue' | 'info'

const ICONS: Record<StatusKey, string> = {
  confirmed: '✓',
  estimated: '≈',
  missing: '?',
  paid: '✓✓',
  overdue: '!',
  info: 'i',
}

const LABELS: Partial<Record<StatusKey, string>> = {
  confirmed: 'Confirmed',
  estimated: 'Estimated',
  missing: 'Missing',
  paid: 'Paid',
  overdue: 'Overdue',
}

/**
 * Text + icon status pill — status is never conveyed by color alone, so
 * confirmed / estimated / missing / paid / overdue stay distinguishable at a
 * glance and for color-blind users.
 */
export function StatusPill({
  status,
  label,
  className = '',
}: {
  status: StatusKey
  /** Optional custom text; defaults to the canonical label. */
  label?: string
  className?: string
}) {
  return (
    <span className={`pill pill-${status} ${className}`}>
      <span aria-hidden="true">{ICONS[status]}</span>
      <span>{label ?? LABELS[status]}</span>
    </span>
  )
}

export function OwnerPill({ owner }: { owner: string | null | undefined }) {
  const map: Record<string, { label: string; cls: string }> = {
    me: { label: "Mine", cls: 'pill-info' },
    wife: { label: "Spouse's", cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', },
    shared: { label: 'Shared', cls: 'pill-confirmed' },
  }
  const v = map[owner || 'me'] || map.me
  return (
    <span className={`pill ${v.cls}`}>
      <span aria-hidden="true">👤</span>
      <span>{v.label}</span>
    </span>
  )
}
