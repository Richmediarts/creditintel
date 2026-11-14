import { getDb } from '@/lib/db'
import { getBankAccounts, getCreditCards, type BudgetBill } from '@/lib/budget-db'
import { resolveBudgetUserId } from '@/lib/household-db'
import { type HomeDebt, type HomeExpense, type HomeMortgage, type HomeAssumptions, validateHomePlan, HOME_DEFAULTS } from '@/lib/utils/home-affordability'

interface Paycheck { employee_name: string | null; gross_pay: number; net_pay: number; pay_period_begin: string | null; pay_period_end: string | null }
export function payPeriodsPerYear(begin: string | null, end: string | null): number {
  if (!begin || !end) return 26
  const days = Math.round((new Date(end).getTime() - new Date(begin).getTime()) / 86400000) + 1
  if (!Number.isFinite(days) || days <= 0) return 26
  return days <= 7 ? 52 : days <= 14 ? 26 : days <= 16 ? 24 : 12
}
export function monthlyBill(amount: number, recurrence?: string): number {
  switch (recurrence) {
    case 'weekly': return amount * 52 / 12
    case 'biweekly': return amount * 26 / 12
    case 'quarterly': return amount / 3
    case 'yearly': case 'annually': case 'annual': return amount / 12
    default: return amount
  }
}
const identity = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
const loanIdentity = (text: string) => identity(text.replace(/\b(auto|car|loan|payment)\b/gi, ''))
const looksLikeDebt = (name: string) => /\bloan\b|\bCC\b|credit|nelnet|discover|paypal|cash\s*rewards|indigo|avant|ollo|prosper|destiny|mission\s*lane|apple\s*card|old\s*navy|fortiva|bridgecrest/i.test(name)
export async function getHomeAffordabilityData(authUserId: number) {
  const userId = await resolveBudgetUserId(authUserId)
  const db = getDb()
  const [accounts, cards, paychecks, bills] = await Promise.all([
    getBankAccounts(userId), getCreditCards(userId),
    db.prepare('SELECT employee_name,gross_pay,net_pay,pay_period_begin,pay_period_end FROM budget_paychecks WHERE user_id = ? ORDER BY check_date DESC NULLS LAST,pay_date DESC LIMIT 24').all(userId) as Promise<Paycheck[]>,
    db.prepare(`SELECT b.*, COALESCE(b.payee_name,p.name,'Bill') AS payee_name, c.name AS category_name
      FROM budget_bills b LEFT JOIN budget_payees p ON p.id=b.payee_id AND p.user_id=b.user_id
      LEFT JOIN budget_categories c ON c.id=b.category_id AND c.user_id=b.user_id
      WHERE b.user_id = ? AND b.is_recurring = 1 ORDER BY b.id`).all(userId) as Promise<(BudgetBill & { category_name: string | null; recurrence_type?: string })[]>,
  ])
  const warnings: string[] = []
  const groups = new Map<string, Paycheck[]>()
  for (const paycheck of paychecks) {
    const key = identity(paycheck.employee_name || '') || 'recorded employee'
    const group = groups.get(key) ?? []
    if (group.length < 4) group.push(paycheck)
    groups.set(key, group)
  }
  const incomeBreakdown: { name: string; monthlyGross: number; monthlyNet: number; periodsPerYear: number }[] = []
  let gross = 0, net = 0
  for (const rows of groups.values()) {
    const periods = payPeriodsPerYear(rows[0].pay_period_begin, rows[0].pay_period_end)
    const monthlyGross = rows.reduce((sum, p) => sum + Number(p.gross_pay || 0), 0) / rows.length * periods / 12
    const monthlyNet = rows.reduce((sum, p) => sum + Number(p.net_pay || 0), 0) / rows.length * periods / 12
    gross += monthlyGross
    net += monthlyNet
    incomeBreakdown.push({ name: rows[0].employee_name || 'Recorded employee', monthlyGross, monthlyNet, periodsPerYear: periods })
  }
  warnings.push('Income is estimated from up to four recent paychecks per recorded employee. Verify frequency, variable pay and any spouse income before relying on results.')
  const active = accounts.filter(account => account.is_active === 1)
  const mortgages: HomeMortgage[] = active.filter(account => account.account_type === 'loan' && account.loan_kind === 'mortgage').map(account => ({
    id: account.id, name: account.name, balance: account.current_balance, apr: account.interest_rate,
    payment: account.monthly_payment ?? null, principalInterest: account.principal_interest_payment ?? null, liens: account.liens ?? [],
  }))
  const used = new Set<number>()
  const debts: HomeDebt[] = []
  const knownAmount = (bill: BudgetBill) => bill.amount_status === 'missing' || bill.amount == null ? null : monthlyBill(Number(bill.amount), bill.recurrence_type)
  for (const loan of active.filter(account => account.account_type === 'loan')) {
    const keys = [loanIdentity(loan.name), loanIdentity(loan.institution || '')].filter(key => key.length >= 4)
    const institutionKey = loanIdentity(loan.institution || '')
    const matching = bills.filter(bill => {
      if (bill.credit_card_id || /\bCC\b|credit|visa|mastercard|amex|cash\s*rewards/i.test(bill.payee_name || '')) return false
      const name = loanIdentity(bill.payee_name || '')
      return identity(bill.payee_name || '') === identity(loan.name) || keys.includes(name) ||
        (institutionKey.length >= 5 && name.startsWith(institutionKey) && looksLikeDebt(bill.payee_name || ''))
    })
    matching.forEach(bill => used.add(bill.id))
    if (loan.loan_kind === 'mortgage' || loan.current_balance <= 0) continue
    const matched = matching.length === 1 ? knownAmount(matching[0]) : null
    debts.push({ id: 'loan-' + loan.id, label: loan.name, balance: loan.current_balance,
      payment: loan.monthly_payment ?? matched, source: loan.monthly_payment != null ? 'Saved liability payment' : matched != null ? 'Matching recurring bill' : 'Monthly payment unknown', payoff: false })
  }
  for (const card of cards.filter(card => card.is_active === 1)) {
    const matching = bills.filter(bill => bill.credit_card_id === card.id)
    matching.forEach(bill => used.add(bill.id))
    if (card.current_balance <= 0) continue
    const amounts = matching.map(knownAmount).filter((amount): amount is number => amount != null)
    const payment = amounts.length ? Math.max(...amounts) : Math.max(25, Math.round(card.current_balance * 0.03 * 100) / 100)
    if (matching.length > 1) warnings.push('Multiple recurring bills match ' + card.name + '; the largest payment is used. Review it.')
    debts.push({ id: 'card-' + card.id, label: card.name + (card.last_four ? ' (••••' + card.last_four + ')' : ''), balance: card.current_balance, payment,
      source: amounts.length ? 'Linked planned card bill; verify minimum required' : 'Estimated minimum: 3% of balance, $25 floor; replace with statement minimum', payoff: false })
  }
  const expenses: HomeExpense[] = []
  let currentMonthlyHOA = 0
  for (const bill of bills) {
    if (used.has(bill.id)) continue
    if (mortgages.length === 1 && /\bHOA\b|homeowners? association/i.test(bill.payee_name || '')) {
      const amount = knownAmount(bill)
      if (amount != null) currentMonthlyHOA += amount
      else warnings.push('Current HOA payment is unknown. Review current housing costs.')
      continue
    }
    if (/credit|debt|loan|collection|mortgage|settlement|judgment|student|installment/i.test(bill.category_name || '') || looksLikeDebt(bill.payee_name || '')) {
      debts.push({ id: 'bill-' + bill.id, label: bill.payee_name || 'Debt bill', balance: null, payment: knownAmount(bill), source: 'Recurring debt bill identified by category / payee; verify payment and balance', payoff: false })
    } else {
      expenses.push({ id: 'bill-' + bill.id, label: bill.payee_name || 'Recurring expense', amount: knownAmount(bill) })
    }
  }
  const cashRow = await db.prepare(`SELECT COALESCE(SUM(current_balance),0) AS total FROM budget_bank_accounts
    WHERE user_id=? AND is_active=1 AND account_type!='loan' AND include_in_available=1`).get(userId) as { total: number }
  if (active.some(account => account.account_type === 'loan' && account.loan_kind !== 'mortgage' && account.liens?.length)) warnings.push('Review liens attached to non-mortgage accounts.')
  const saved = await db.prepare('SELECT settings FROM budget_affordability_preferences WHERE user_id=?').get(userId) as { settings: Partial<HomeAssumptions> & { currentLocation?: string; buyingLocation?: string; vaEligibility?: string } } | null
  const base = { ...HOME_DEFAULTS, monthlyGrossIncome: Math.round(gross * 100) / 100, monthlyNetIncome: Math.round(net * 100) / 100, cashOnHand: Number(cashRow.total), currentMonthlyHOA: Math.round(currentMonthlyHOA * 100) / 100 }
  let assumptions = { ...base }
  if (saved?.settings) {
    for (const key of Object.keys(HOME_DEFAULTS) as (keyof HomeAssumptions)[]) {
      if (key !== 'cashOnHand' && saved.settings[key] !== undefined) Object.assign(assumptions, { [key]: saved.settings[key] })
    }
    if (!validateHomePlan({ assumptions, mortgage: mortgages[0] ?? null, debts, expenses })) {
      assumptions = base
      warnings.push('Saved planning defaults were invalid; live defaults are used.')
    }
  }
  return {
    mortgages, debts, expenses, warnings, incomeBreakdown, assumptions,
    currentLocation: saved?.settings.currentLocation || '',
    buyingLocation: saved?.settings.buyingLocation || '',
    vaEligibility: saved?.settings.vaEligibility || 'unknown',
    confirmedGrossIncome: saved?.settings.monthlyGrossIncome ?? null,
    incomeSource: groups.size + ' recorded employee group(s); review all borrowers',
    selectedCashSource: 'Active accounts selected for available cash',
  }
}

export type HomeSourceData = Awaited<ReturnType<typeof getHomeAffordabilityData>>
