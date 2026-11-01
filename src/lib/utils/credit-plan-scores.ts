export interface CreditPlanScore { bureau: string; score: number | null }

/** The FICO endpoint returns a bureau-keyed object, not an array. */
export function normalizeCreditPlanScores(value: unknown): CreditPlanScore[] {
  if (!value || typeof value !== 'object') return []
  const rows = Array.isArray(value) ? value : Object.entries(value).map(([bureau, entry]) => ({
    bureau, score: entry && typeof entry === 'object' ? (entry as Record<string, unknown>).score : null,
  }))
  return rows.flatMap(row => {
    if (!row || typeof row !== 'object' || typeof row.bureau !== 'string') return []
    const score = row.score
    return [{ bureau: row.bureau, score: typeof score === 'number' && Number.isFinite(score) ? score : null }]
  })
}
