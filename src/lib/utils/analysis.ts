import type { AIFinding, DisputeItem, MergedAccount, BureauReport, GlobalSummary, Bureau, Account } from '@/types'

export { type AIFinding }

export function generateAIFindings(
  reports: BureauReport[],
  mergedAccounts: MergedAccount[],
  globalSummary: GlobalSummary
): AIFinding[] {
  const findings: AIFinding[] = []

  // Find discrepancies across bureaus
  for (const ma of mergedAccounts) {
    if (ma.discrepancies.length > 0 && ma.reportedOn.length > 1) {
      for (const disc of ma.discrepancies) {
        findings.push({
          type: 'discrepancy',
          description: `${ma.creditorName}: ${disc.field} differs across bureaus (${disc.values.map(v => `${v.bureau}: ${v.value}`).join(', ')})`,
          severity: 'high',
          accounts: [ma.id],
          bureaus: ma.reportedOn,
        })
      }
    }
  }

  // Find high utilization accounts
  for (const report of reports) {
    for (const account of report.accounts) {
      if (account.creditLimit && account.creditLimit > 0) {
        const utilization = (account.balance / account.creditLimit) * 100
        if (utilization > 70) {
          findings.push({
            type: 'high_utilization',
            description: `${account.creditorName}: ${utilization.toFixed(0)}% utilization on ${report.bureau} ($${account.balance} of $${account.creditLimit})`,
            severity: utilization > 90 ? 'high' : 'medium',
            accounts: [account.id],
            bureaus: [report.bureau],
            estimatedScoreImpact: utilization > 90 ? -30 : -15,
          })
        }
      }
    }
  }

  // Find duplicate accounts
  const nameCount = new Map<string, MergedAccount[]>()
  for (const ma of mergedAccounts) {
    const key = ma.creditorName.toLowerCase().replace(/[^a-z0-9]/g, '')
    const existing = nameCount.get(key) || []
    existing.push(ma)
    nameCount.set(key, existing)
  }

  // Eligible for dispute
  for (const ma of mergedAccounts) {
    const hasDerogatory = Object.values(ma.accounts).some((a: Account | undefined) => a?.isDerogatory)
    if (hasDerogatory) {
      const bureaus = Object.entries(ma.accounts)
        .filter(([, a]: [string, Account | undefined]) => a?.isDerogatory)
        .map(([b]) => b as Bureau)

      findings.push({
        type: 'eligible_dispute',
        description: `${ma.creditorName} appears on ${bureaus.join(', ')} with derogatory status - eligible for dispute`,
        severity: 'medium',
        accounts: [ma.id],
        bureaus,
        estimatedScoreImpact: 15,
      })
    }
  }

  // Inconsistent Date First Delinquency
  for (const ma of mergedAccounts) {
    const accounts = Object.values(ma.accounts).filter(Boolean) as Account[]
    if (accounts.length > 1) {
      const removalDates = accounts.filter(a => a.estimatedRemovalDate).map(a => a.estimatedRemovalDate!)
      if (new Set(removalDates).size > 1) {
        findings.push({
          type: 'inconsistency',
          description: `${ma.creditorName}: Removal date differs across bureaus (${removalDates.join(', ')})`,
          severity: 'medium',
          accounts: [ma.id],
          bureaus: ma.reportedOn,
          estimatedScoreImpact: 10,
        })
      }
    }
  }

  // Early exclusion candidates
  for (const report of reports) {
    const now = new Date()
    for (const account of report.accounts) {
      if (account.estimatedRemovalDate) {
        const removalDate = new Date(account.estimatedRemovalDate)
        const monthsUntilRemoval = (removalDate.getFullYear() - now.getFullYear()) * 12 + (removalDate.getMonth() - now.getMonth())
        if (monthsUntilRemoval <= 6 && monthsUntilRemoval > 0) {
          findings.push({
            type: 'early_exclusion',
            description: `${account.creditorName} on ${report.bureau} eligible for early exclusion (removal ${account.estimatedRemovalDate})`,
            severity: 'high',
            accounts: [account.id],
            bureaus: [report.bureau],
            estimatedScoreImpact: 20,
          })
        }
      }
    }
  }

  // Score improvement estimates
  const derogCount = globalSummary.totalDerogatory
  if (derogCount > 0) {
    findings.push({
      type: 'score_improvement',
      description: `Resolving all ${derogCount} derogatory items could improve score by an estimated ${derogCount * 15}-${derogCount * 30} points`,
      severity: 'high',
      estimatedScoreImpact: derogCount * 20,
    })
  }

  return findings
}

export function generateDisputeItems(
  reports: BureauReport[],
  mergedAccounts: MergedAccount[]
): DisputeItem[] {
  const items: DisputeItem[] = []

  for (const ma of mergedAccounts) {
    const accounts = Object.entries(ma.accounts) as [Bureau, Account][]
    for (const [bureau, account] of accounts) {
      if (!account) continue
      const inaccuracies: DisputeItem['inaccuracies'] = []

      if (account.isChargeOff && account.balance > 0) {
        inaccuracies.push('balance')
      }

      const hasLatePayments = account.paymentHistory?.some(ph =>
        ph.rating !== 'OK' && ph.rating !== '' && ph.rating !== 'N/R'
      )
      if (hasLatePayments) {
        inaccuracies.push('late_payment')
      }

      if (ma.discrepancies.length > 0) {
        inaccuracies.push('fcra_violation')
      }

      if (account.estimatedRemovalDate) {
        const removalDate = new Date(account.estimatedRemovalDate)
        const now = new Date()
        if (removalDate < now) {
          inaccuracies.push('obsolete')
        }
      }

      if (inaccuracies.length > 0) {
        items.push({
          accountId: ma.id,
          creditorName: account.creditorName,
          bureau,
          reasons: inaccuracies.map(i => {
            const reasons: Record<string, string> = {
              balance: 'Incorrect Balance',
              late_payment: 'Incorrect Late Payment',
              not_my_account: 'Not My Account',
              duplicate: 'Duplicate',
              obsolete: 'Obsolete',
              identity_theft: 'Identity Theft',
              missing_payment: 'Missing Payment',
              fcra_violation: 'FCRA Violation - Inconsistent Reporting',
            }
            return reasons[i]
          }),
          inaccuracies,
          recommendedAction: 'Dispute with credit bureau',
          estimatedScoreGain: inaccuracies.length * 10,
        })
      }
    }
  }

  return items
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}
