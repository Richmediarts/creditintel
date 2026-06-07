import type { BureauReport, GlobalSummary, MergedAccount } from '@/types'

export interface ScoreSimulation {
  currentEstimatedScore: number
  scenarios: ScoreScenario[]
}

export interface ScoreScenario {
  name: string
  description: string
  impact: number
  newScore: number
  itemsAffected: number
}

export function simulateScoreImprovements(
  reports: BureauReport[],
  mergedAccounts: MergedAccount[],
  globalSummary: GlobalSummary
): ScoreSimulation {
  const baseScore = estimateBaseScore(globalSummary)
  const scenarios: ScoreScenario[] = []

  // Scenario 1: Remove all derogatory accounts
  const derogCount = globalSummary.totalDerogatory
  if (derogCount > 0) {
    const impact = Math.min(derogCount * 15, 80)
    scenarios.push({
      name: 'Remove Derogatory Accounts',
      description: `Remove all ${derogCount} derogatory accounts`,
      impact,
      newScore: Math.min(baseScore + impact, 850),
      itemsAffected: derogCount,
    })
  }

  // Scenario 2: Reduce credit utilization
  if (globalSummary.totalCreditUtilization > 30) {
    const targetUtilization = 10
    const reduction = globalSummary.totalCreditUtilization - targetUtilization
    const impact = Math.min(Math.floor(reduction / 5) * 10, 50)
    scenarios.push({
      name: 'Reduce Credit Utilization',
      description: `Reduce utilization from ${globalSummary.totalCreditUtilization.toFixed(0)}% to ${targetUtilization}%`,
      impact,
      newScore: Math.min((scenarios[0]?.newScore || baseScore) + impact, 850),
      itemsAffected: reports.reduce((sum, r) =>
        sum + r.accounts.filter(a => a.creditLimit && (a.balance / a.creditLimit) > 0.7).length, 0
      ),
    })
  }

  // Scenario 3: Remove charge-offs
  if (globalSummary.totalChargeOffs > 0) {
    const impact = Math.min(globalSummary.totalChargeOffs * 20, 60)
    const lastScore = scenarios.length > 0 ? scenarios[scenarios.length - 1].newScore : baseScore
    scenarios.push({
      name: 'Remove Charge-Off Accounts',
      description: `Remove ${globalSummary.totalChargeOffs} charged-off accounts`,
      impact,
      newScore: Math.min(lastScore + impact, 850),
      itemsAffected: globalSummary.totalChargeOffs,
    })
  }

  // Scenario 4: Remove collections
  if (globalSummary.totalCollections > 0) {
    const impact = Math.min(globalSummary.totalCollections * 25, 50)
    const lastScore = scenarios.length > 0 ? scenarios[scenarios.length - 1].newScore : baseScore
    scenarios.push({
      name: 'Remove Collections',
      description: `Remove ${globalSummary.totalCollections} collection accounts`,
      impact,
      newScore: Math.min(lastScore + impact, 850),
      itemsAffected: globalSummary.totalCollections,
    })
  }

  // Scenario 5: Remove hard inquiries
  if (globalSummary.totalHardInquiries > 5) {
    const excessInquiries = globalSummary.totalHardInquiries - 3
    const impact = Math.min(excessInquiries * 3, 15)
    const lastScore = scenarios.length > 0 ? scenarios[scenarios.length - 1].newScore : baseScore
    scenarios.push({
      name: 'Remove Excess Hard Inquiries',
      description: `Remove ${excessInquiries} excess hard inquiries (keep 3)`,
      impact,
      newScore: Math.min(lastScore + impact, 850),
      itemsAffected: excessInquiries,
    })
  }

  // Max possible improvement
  if (scenarios.length > 1) {
    const totalImpact = scenarios.reduce((sum, s) => sum + s.impact, 0)
    scenarios.push({
      name: 'Maximum Potential Improvement',
      description: 'Apply all corrections simultaneously',
      impact: totalImpact,
      newScore: Math.min(baseScore + totalImpact, 850),
      itemsAffected: scenarios.reduce((sum, s) => sum + s.itemsAffected, 0),
    })
  }

  return {
    currentEstimatedScore: baseScore,
    scenarios,
  }
}

function estimateBaseScore(summary: GlobalSummary): number {
  let score = 700

  // Derogatory accounts reduce score
  score -= summary.totalDerogatory * 15

  // Charge-offs have heavy impact
  score -= summary.totalChargeOffs * 20

  // Collections
  score -= summary.totalCollections * 25

  // Late accounts
  score -= summary.totalLateAccounts * 10

  // Hard inquiries (over 3)
  if (summary.totalHardInquiries > 3) {
    score -= (summary.totalHardInquiries - 3) * 3
  }

  // High utilization
  if (summary.totalCreditUtilization > 30) {
    score -= Math.floor((summary.totalCreditUtilization - 30) / 10) * 10
  }

  // Public records
  score -= summary.totalPublicRecords * 40

  // Bankruptcies
  score -= summary.totalBankruptcies * 100

  return Math.max(300, Math.min(850, score))
}
