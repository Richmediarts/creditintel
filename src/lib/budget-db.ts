import { getDb } from '@/lib/db'

export interface BudgetPaycheck {
  id: number
  pay_date?: string
  pay_period_begin?: string
  pay_period_end?: string
  check_date?: string
  check_number?: string
  employee_name?: string
  employee_id?: string
  company?: string
  hours_worked?: number
  gross_pay?: number
  pre_tax_deductions?: number
  employee_taxes?: number
  post_tax_deductions?: number
  net_pay?: number
  salary?: number
  biometric_credit?: number
  floating_holiday?: number
  holiday_pay?: number
  vacation_pay?: number
  group_term_life?: number
  spousal_biometric?: number
  other_earnings?: number
  oasdi?: number
  medicare?: number
  federal_tax?: number
  state_tax?: number
  state_name?: string
  social_security?: number
  retirement_401k?: number
  add_insurance?: number
  dental_plan?: number
  eye_plan?: number
  health_care_fsa?: number
  health_insurance?: number
  optional_life?: number
  hsa?: number
  loan_repayment?: number
  dependent_life?: number
  stock_purchase?: number
  spousal_life?: number
  employer_match?: number
  employer_hsa?: number
  federal_filing_status?: string
  state_filing_status?: string
  federal_allowances?: number
  dependent_amount?: number
  additional_withholding?: number
  bank_name?: string
  account_number?: string
  deposit_amount?: number
  bank2_name?: string
  account2_number?: string
  deposit2_amount?: number
  notes?: string
  gross_pay_ytd?: number
  pre_tax_deductions_ytd?: number
  employee_taxes_ytd?: number
  post_tax_deductions_ytd?: number
  net_pay_ytd?: number
  hours_worked_ytd?: number
  retirement_401k_ytd?: number
  health_insurance_ytd?: number
  dental_plan_ytd?: number
  eye_plan_ytd?: number
  health_care_fsa_ytd?: number
  optional_life_ytd?: number
  add_insurance_ytd?: number
  federal_tax_ytd?: number
  state_tax_ytd?: number
  oasdi_ytd?: number
  medicare_ytd?: number
  employer_match_ytd?: number
  hsa_ytd?: number
  loan_repayment_ytd?: number
  dependent_life_ytd?: number
  stock_purchase_ytd?: number
  spousal_life_ytd?: number
  biometric_credit_ytd?: number
  spousal_biometric_ytd?: number
  group_term_life_ytd?: number
  floating_holiday_ytd?: number
  holiday_pay_ytd?: number
  vacation_pay_ytd?: number
  salary_ytd?: number
}

const PAYCHECK_COLUMNS = [
  'pay_date', 'pay_period_begin', 'pay_period_end', 'check_date', 'check_number',
  'employee_name', 'employee_id', 'company', 'hours_worked', 'gross_pay',
  'pre_tax_deductions', 'employee_taxes', 'post_tax_deductions', 'net_pay',
  'salary', 'biometric_credit', 'floating_holiday', 'holiday_pay', 'vacation_pay',
  'group_term_life', 'spousal_biometric', 'other_earnings', 'oasdi', 'medicare',
  'federal_tax', 'state_tax', 'state_name', 'social_security', 'retirement_401k',
  'add_insurance', 'dental_plan', 'eye_plan', 'health_care_fsa', 'health_insurance',
  'optional_life', 'hsa', 'loan_repayment', 'dependent_life', 'stock_purchase',
  'spousal_life', 'employer_match', 'employer_hsa', 'federal_filing_status', 'state_filing_status',
  'federal_allowances', 'dependent_amount', 'additional_withholding',
  'bank_name', 'account_number', 'deposit_amount', 'bank2_name', 'account2_number',
  'deposit2_amount', 'notes',
  'gross_pay_ytd', 'pre_tax_deductions_ytd', 'employee_taxes_ytd', 'post_tax_deductions_ytd',
  'net_pay_ytd', 'hours_worked_ytd', 'retirement_401k_ytd', 'health_insurance_ytd',
  'dental_plan_ytd', 'eye_plan_ytd', 'health_care_fsa_ytd', 'optional_life_ytd',
  'add_insurance_ytd', 'federal_tax_ytd', 'state_tax_ytd', 'oasdi_ytd', 'medicare_ytd',
  'employer_match_ytd', 'hsa_ytd', 'loan_repayment_ytd', 'dependent_life_ytd',
  'stock_purchase_ytd', 'spousal_life_ytd', 'biometric_credit_ytd', 'spousal_biometric_ytd',
  'group_term_life_ytd', 'floating_holiday_ytd', 'holiday_pay_ytd', 'vacation_pay_ytd',
  'salary_ytd',
] as const

export interface BudgetStats {
  total_bank: number
  total_credit: number
  total_income: number
  total_income_accounts: number
  last_paycheck_net: number
  total_expenses: number
  total_expenses_paid: number
  bills_before_next_pay: Array<{ id: number; payee_name?: string; amount: number; due_date: string }>
  bills_before_next_pay_total: number
  next_paycheck_date: string | null
  remaining: number
  upcoming_bills: Array<{ id: number; payee_name?: string; amount: number; due_date: string; is_paid: number }>
  last_paycheck: (BudgetPaycheck & { id: number }) | null
  last_paycheck_date: string | null
  current_period_income: (BudgetPaycheck & { id: number }) | null
  biweekly_income: number
  biweekly_expenses: number
  biweekly_remaining: number
  monthly_income: number
  monthly_expenses: number
  monthly_expenses_paid: number
  monthly_expenses_due: number
  monthly_remaining: number
}

export interface BudgetPayee {
  id: number
  user_id: number
  name: string
  category?: string
  account_number?: string
  notes?: string
  website?: string
  default_category_id?: number
}

export interface BudgetBankAccount {
  id: number
  user_id: number
  name: string
  account_type: string
  institution?: string
  account_number_last4?: string
  current_balance: number
  website?: string
  is_active: number
  is_income_account: number
  interest_rate: number
  plaid_account_id?: string
  plaid_item_id?: number
}

export interface BudgetCreditCard {
  id: number
  user_id: number
  name: string
  last_four?: string
  institution?: string
  credit_limit: number
  current_balance: number
  interest_rate: number
  due_date?: string
  website?: string
  is_active: number
  plaid_account_id?: string
  plaid_item_id?: number
}

export interface BudgetBill {
  id: number
  user_id: number
  payee_id?: number
  payee_name?: string
  amount: number
  due_date: string
  is_paid: number
  paid_date?: string
  is_recurring: number
  recurrence_type?: string
  notes?: string
  category_id?: number
  account?: string
  credit_card_id?: number
}

export interface BudgetCategory {
  id: number
  user_id: number
  name: string
  monthly_limit: number
  color: string
  parent_id?: number
  actual_spent: number
}

export interface BudgetTransaction {
  id: number
  user_id: number
  account_id: number
  date: string
  description: string
  amount: number
  balance: number
  created_at: string
}

export interface BudgetModifiedIncome {
  id: number
  user_id: number
  amount: number
  entry_date: string
  period_type: string
  notes: string
  created_at: string
}

function ensureSchemaOnce(): void {
  // Schema is managed by Postgres (see db.ts ensureSchema)
}

// Paychecks
export async function getPaychecks(userId: number): Promise<(BudgetPaycheck & { id: number })[]> {
  const db = getDb()
  return (await db.prepare('SELECT * FROM budget_paychecks WHERE user_id = ? ORDER BY check_date DESC, pay_date DESC').all(userId)) as (BudgetPaycheck & { id: number })[]
}

export async function getPaycheck(userId: number, id: number): Promise<(BudgetPaycheck & { id: number }) | null> {
  const db = getDb()
  return ((await db.prepare('SELECT * FROM budget_paychecks WHERE user_id = ? AND id = ?').get(userId, id)) as (BudgetPaycheck & { id: number }) | undefined) ?? null
}

const NUMERIC_COLUMNS = new Set<string>([
  'hours_worked', 'gross_pay', 'pre_tax_deductions', 'employee_taxes', 'post_tax_deductions',
  'net_pay', 'salary', 'biometric_credit', 'floating_holiday', 'holiday_pay', 'vacation_pay',
  'group_term_life', 'spousal_biometric', 'other_earnings', 'oasdi', 'medicare', 'federal_tax',
  'state_tax', 'social_security', 'retirement_401k', 'add_insurance', 'dental_plan', 'eye_plan',
  'health_care_fsa', 'health_insurance', 'optional_life', 'hsa', 'loan_repayment', 'dependent_life',
  'stock_purchase', 'spousal_life', 'employer_match', 'employer_hsa', 'deposit_amount', 'deposit2_amount',
  'federal_allowances', 'dependent_amount', 'additional_withholding',
  'gross_pay_ytd', 'pre_tax_deductions_ytd', 'employee_taxes_ytd', 'post_tax_deductions_ytd',
  'net_pay_ytd', 'hours_worked_ytd', 'retirement_401k_ytd', 'health_insurance_ytd',
  'dental_plan_ytd', 'eye_plan_ytd', 'health_care_fsa_ytd', 'optional_life_ytd',
  'add_insurance_ytd', 'federal_tax_ytd', 'state_tax_ytd', 'oasdi_ytd', 'medicare_ytd',
  'employer_match_ytd', 'hsa_ytd', 'loan_repayment_ytd', 'dependent_life_ytd',
  'stock_purchase_ytd', 'spousal_life_ytd', 'biometric_credit_ytd', 'spousal_biometric_ytd',
  'group_term_life_ytd', 'floating_holiday_ytd', 'holiday_pay_ytd', 'vacation_pay_ytd',
  'salary_ytd',
])

const DATE_COLUMNS = new Set<string>(['pay_date', 'pay_period_begin', 'pay_period_end', 'check_date'])

function normalizePaycheckValue(c: string, v: unknown): string | number | null {
  if (v === undefined || v === null || v === '') {
    if (DATE_COLUMNS.has(c)) return null
    return NUMERIC_COLUMNS.has(c) ? 0 : ''
  }
  return NUMERIC_COLUMNS.has(c) ? Number(v) : String(v)
}

export async function addPaycheck(userId: number, data: Partial<BudgetPaycheck>): Promise<number> {
  const db = getDb()
  const cols = [...PAYCHECK_COLUMNS]
  const values = cols.map((c) => normalizePaycheckValue(c, (data as Record<string, unknown>)[c]))
  const placeholders = cols.map(() => '?').join(', ')
  const result = await db.prepare(
    `INSERT INTO budget_paychecks (user_id, ${cols.join(', ')}) VALUES (?, ${placeholders}) RETURNING id`
  ).run(userId, ...values)
  return Number(result.lastInsertRowid)
}

export async function updatePaycheck(userId: number, id: number, data: Partial<BudgetPaycheck>): Promise<void> {
  const db = getDb()
  const setClauses: string[] = []
  const values: unknown[] = []
  for (const c of PAYCHECK_COLUMNS) {
    if ((data as Record<string, unknown>)[c] !== undefined) {
      setClauses.push(`${c} = ?`)
      values.push(normalizePaycheckValue(c, (data as Record<string, unknown>)[c]))
    }
  }
  if (setClauses.length === 0) return
  values.push(id, userId)
  await db.prepare(`UPDATE budget_paychecks SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`).run(...values)
}

export async function deletePaycheck(userId: number, id: number): Promise<void> {
  const db = getDb()
  await db.prepare('DELETE FROM budget_paychecks WHERE user_id = ? AND id = ?').run(userId, id)
}

export async function getNextPaycheckDate(userId: number): Promise<string | null> {
  const paychecks = await getPaychecks(userId)
  if (paychecks.length === 0) return null
  const latest = paychecks[0]
  if (!latest.check_date && !latest.pay_date) return null
  const lastDate = new Date(latest.check_date || latest.pay_date || '')
  if (isNaN(lastDate.getTime())) return null
  const next = new Date(lastDate.getTime() + 14 * 86400000)
  const now = new Date()
  while (next < now) {
    next.setTime(next.getTime() + 14 * 86400000)
  }
  return next.toISOString().split('T')[0]
}

export async function getBudgetStats(userId: number): Promise<BudgetStats> {
  const db = getDb()

  const totalBank = (await db.prepare('SELECT COALESCE(SUM(current_balance), 0) as t FROM budget_bank_accounts WHERE user_id = ? AND is_active = 1').get(userId) as { t: number }).t
  const totalCredit = (await db.prepare('SELECT COALESCE(SUM(current_balance), 0) as t FROM budget_credit_cards WHERE user_id = ? AND is_active = 1').get(userId) as { t: number }).t

  const totalIncomeAccounts = (await db.prepare('SELECT COALESCE(SUM(current_balance), 0) as t FROM budget_bank_accounts WHERE user_id = ? AND is_active = 1 AND is_income_account = 1').get(userId) as { t: number }).t

  const lastPaycheckRow = (await db.prepare(
    'SELECT * FROM budget_paychecks WHERE user_id = ? ORDER BY check_date DESC, pay_date DESC LIMIT 1'
  ).get(userId)) as (BudgetPaycheck & { id: number }) | undefined
  const lastPaycheckNet = lastPaycheckRow?.net_pay || 0
  const lastPaycheckDate = lastPaycheckRow?.check_date || lastPaycheckRow?.pay_date || null

  const nextPaycheck = await getNextPaycheckDate(userId)

  let totalExpensesPaid = 0
  if (nextPaycheck && lastPaycheckDate) {
    totalExpensesPaid = (await db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as t FROM budget_bills WHERE user_id = ? AND is_paid = 1 AND paid_date >= ? AND paid_date <= ?'
    ).get(userId, lastPaycheckDate, nextPaycheck) as { t: number }).t
  } else {
    totalExpensesPaid = (await db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as t FROM budget_bills WHERE user_id = ? AND is_paid = 1'
    ).get(userId) as { t: number }).t
  }

  let billsBeforeNextPay: BudgetStats['bills_before_next_pay'] = []
  let billsBeforeNextPayTotal = 0
  if (nextPaycheck) {
    billsBeforeNextPay = (await db.prepare(`
      SELECT b.id, COALESCE(b.payee_name, p.name) as payee_name, b.amount, b.due_date
      FROM budget_bills b
      LEFT JOIN budget_payees p ON b.payee_id = p.id
      WHERE b.user_id = ? AND b.is_paid = 0 AND b.due_date <= ?
      ORDER BY b.due_date ASC
    `).all(userId, nextPaycheck)) as BudgetStats['bills_before_next_pay']
    billsBeforeNextPayTotal = billsBeforeNextPay.reduce((s, b) => s + (Number(b.amount) || 0), 0)
  }

  const upcomingBills = (await db.prepare(`
    SELECT b.id, COALESCE(b.payee_name, p.name) as payee_name, b.amount, b.due_date, b.is_paid
    FROM budget_bills b
    LEFT JOIN budget_payees p ON b.payee_id = p.id
    WHERE b.user_id = ? AND b.is_paid = 0
    ORDER BY b.due_date ASC LIMIT 5
  `).all(userId)) as BudgetStats['upcoming_bills']

  const totalExpenses = totalExpensesPaid + billsBeforeNextPayTotal

  const biweeklyIncome = lastPaycheckNet
  const totalBudget = (await db.prepare('SELECT COALESCE(SUM(monthly_limit), 0) as t FROM budget_categories WHERE user_id = ?').get(userId) as { t: number }).t
  const biweeklyExpenses = totalBudget ? totalBudget / 2 : 0
  const biweeklyRemaining = biweeklyIncome - biweeklyExpenses
  const monthlyIncome = lastPaycheckNet ? lastPaycheckNet * 26 / 12 : 0
  const monthlyExpenses = totalBudget
  const monthlyRemaining = monthlyIncome - monthlyExpenses

  // Monthly expenses paid/due (30-day window)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]
  const todayStr = new Date().toISOString().split('T')[0]
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  const thirtyDaysFromNowStr = thirtyDaysFromNow.toISOString().split('T')[0]

  const monthlyExpensesPaid = (await db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as t FROM budget_bills WHERE user_id = ? AND is_paid = 1 AND paid_date >= ? AND paid_date <= ?'
  ).get(userId, thirtyDaysAgoStr, todayStr) as { t: number }).t

  const monthlyExpensesDue = (await db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as t FROM budget_bills WHERE user_id = ? AND is_paid = 0 AND due_date >= ? AND due_date <= ?'
  ).get(userId, todayStr, thirtyDaysFromNowStr) as { t: number }).t

  // Current period income = last paycheck object
  const currentPeriodIncome = lastPaycheckRow || null

  // Total income = income accounts + last paycheck net
  const totalIncome = totalIncomeAccounts + lastPaycheckNet
  const remaining = totalIncome - totalExpenses

  return {
    total_bank: totalBank,
    total_credit: totalCredit,
    total_income: totalIncome,
    total_income_accounts: totalIncomeAccounts,
    last_paycheck_net: lastPaycheckNet,
    total_expenses: totalExpenses,
    total_expenses_paid: totalExpensesPaid,
    bills_before_next_pay: billsBeforeNextPay,
    bills_before_next_pay_total: billsBeforeNextPayTotal,
    next_paycheck_date: nextPaycheck,
    remaining: remaining,
    upcoming_bills: upcomingBills,
    last_paycheck: lastPaycheckRow || null,
    last_paycheck_date: lastPaycheckDate,
    current_period_income: currentPeriodIncome,
    biweekly_income: biweeklyIncome,
    biweekly_expenses: biweeklyExpenses,
    biweekly_remaining: biweeklyRemaining,
    monthly_income: monthlyIncome,
    monthly_expenses: monthlyExpenses,
    monthly_expenses_paid: monthlyExpensesPaid,
    monthly_expenses_due: monthlyExpensesDue,
    monthly_remaining: monthlyRemaining,
  }
}

// Payees
export async function getPayees(userId: number): Promise<BudgetPayee[]> {
  const db = getDb()
  return (await db.prepare('SELECT * FROM budget_payees WHERE user_id = ? ORDER BY name').all(userId)) as BudgetPayee[]
}

export async function getPayee(userId: number, id: number): Promise<BudgetPayee | null> {
  const db = getDb()
  return ((await db.prepare('SELECT * FROM budget_payees WHERE user_id = ? AND id = ?').get(userId, id)) as BudgetPayee | undefined) ?? null
}

export async function addPayee(userId: number, data: Partial<BudgetPayee>): Promise<number> {
  const db = getDb()
  const result = await db.prepare(
    'INSERT INTO budget_payees (user_id, name, category, account_number, notes, website, default_category_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id'
  ).run(userId, data.name || '', data.category || '', data.account_number || '', data.notes || '', data.website || '', data.default_category_id || null)
  return Number(result.lastInsertRowid)
}

export async function updatePayee(userId: number, id: number, data: Partial<BudgetPayee>): Promise<void> {
  const db = getDb()
  await db.prepare(
    'UPDATE budget_payees SET name = ?, category = ?, account_number = ?, notes = ?, website = ?, default_category_id = ? WHERE user_id = ? AND id = ?'
  ).run(data.name || '', data.category || '', data.account_number || '', data.notes || '', data.website || '', data.default_category_id || null, userId, id)
}

export async function deletePayee(userId: number, id: number): Promise<void> {
  const db = getDb()
  await db.prepare('DELETE FROM budget_payees WHERE user_id = ? AND id = ?').run(userId, id)
}

export async function getPayeeByName(userId: number, name: string): Promise<BudgetPayee | null> {
  const db = getDb()
  return ((await db.prepare('SELECT * FROM budget_payees WHERE user_id = ? AND name = ?').get(userId, name)) as BudgetPayee | undefined) ?? null
}

// Bank Accounts
export async function getBankAccounts(userId: number): Promise<BudgetBankAccount[]> {
  const db = getDb()
  return (await db.prepare('SELECT * FROM budget_bank_accounts WHERE user_id = ? ORDER BY name').all(userId)) as BudgetBankAccount[]
}

export async function getBankAccount(userId: number, id: number): Promise<BudgetBankAccount | null> {
  const db = getDb()
  return ((await db.prepare('SELECT * FROM budget_bank_accounts WHERE user_id = ? AND id = ?').get(userId, id)) as BudgetBankAccount | undefined) ?? null
}

export async function addBankAccount(userId: number, data: Partial<BudgetBankAccount>): Promise<number> {
  const db = getDb()
  const result = await db.prepare(
    'INSERT INTO budget_bank_accounts (user_id, name, account_type, institution, account_number_last4, current_balance, website, is_active, is_income_account, interest_rate, plaid_account_id, plaid_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
  ).run(
    userId,
    data.name || '',
    data.account_type || 'checking',
    data.institution || '',
    data.account_number_last4 || '',
    data.current_balance || 0,
    data.website || '',
    data.is_active !== undefined ? data.is_active : 1,
    data.is_income_account || 0,
    data.interest_rate || 0,
    data.plaid_account_id || null,
    data.plaid_item_id || null
  )
  return Number(result.lastInsertRowid)
}

export async function updateBankAccount(userId: number, id: number, data: Partial<BudgetBankAccount>): Promise<void> {
  const db = getDb()
  await db.prepare(
    'UPDATE budget_bank_accounts SET name = ?, account_type = ?, institution = ?, account_number_last4 = ?, current_balance = ?, website = ?, is_active = ?, is_income_account = ?, interest_rate = ?, plaid_account_id = ?, plaid_item_id = ? WHERE user_id = ? AND id = ?'
  ).run(
    data.name || '',
    data.account_type || 'checking',
    data.institution || '',
    data.account_number_last4 || '',
    data.current_balance || 0,
    data.website || '',
    data.is_active !== undefined ? data.is_active : 1,
    data.is_income_account || 0,
    data.interest_rate || 0,
    data.plaid_account_id || null,
    data.plaid_item_id || null,
    userId,
    id
  )
}

export async function deleteBankAccount(userId: number, id: number): Promise<void> {
  const db = getDb()
  await db.prepare('DELETE FROM budget_bank_accounts WHERE user_id = ? AND id = ?').run(userId, id)
}

export async function updateBankAccountBalance(userId: number, id: number, balance: number): Promise<void> {
  const db = getDb()
  await db.prepare('UPDATE budget_bank_accounts SET current_balance = ? WHERE user_id = ? AND id = ?').run(balance, userId, id)
}

export async function clearBankAccountPlaid(userId: number, id: number): Promise<void> {
  const db = getDb()
  await db.prepare('UPDATE budget_bank_accounts SET plaid_account_id = NULL, plaid_item_id = NULL, current_balance = 0 WHERE user_id = ? AND id = ?').run(userId, id)
  await db.prepare('DELETE FROM budget_transactions WHERE user_id = ? AND account_id = ?').run(userId, id)
}

// Credit Cards
export async function getCreditCards(userId: number): Promise<BudgetCreditCard[]> {
  const db = getDb()
  return (await db.prepare('SELECT * FROM budget_credit_cards WHERE user_id = ? ORDER BY name').all(userId)) as BudgetCreditCard[]
}

export async function getCreditCard(userId: number, id: number): Promise<BudgetCreditCard | null> {
  const db = getDb()
  return ((await db.prepare('SELECT * FROM budget_credit_cards WHERE user_id = ? AND id = ?').get(userId, id)) as BudgetCreditCard | undefined) ?? null
}

export async function addCreditCard(userId: number, data: Partial<BudgetCreditCard>): Promise<number> {
  const db = getDb()
  const result = await db.prepare(
    'INSERT INTO budget_credit_cards (user_id, name, last_four, institution, credit_limit, current_balance, interest_rate, due_date, website, is_active, plaid_account_id, plaid_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
  ).run(
    userId,
    data.name || '',
    data.last_four || '',
    data.institution || '',
    data.credit_limit || 0,
    data.current_balance || 0,
    data.interest_rate || 0,
    data.due_date || '',
    data.website || '',
    data.is_active !== undefined ? data.is_active : 1,
    data.plaid_account_id || null,
    data.plaid_item_id || null
  )
  return Number(result.lastInsertRowid)
}

export async function updateCreditCard(userId: number, id: number, data: Partial<BudgetCreditCard>): Promise<void> {
  const db = getDb()
  await db.prepare(
    'UPDATE budget_credit_cards SET name = ?, last_four = ?, institution = ?, credit_limit = ?, current_balance = ?, interest_rate = ?, due_date = ?, website = ?, is_active = ?, plaid_account_id = ?, plaid_item_id = ? WHERE user_id = ? AND id = ?'
  ).run(
    data.name || '',
    data.last_four || '',
    data.institution || '',
    data.credit_limit || 0,
    data.current_balance || 0,
    data.interest_rate || 0,
    data.due_date || '',
    data.website || '',
    data.is_active !== undefined ? data.is_active : 1,
    data.plaid_account_id || null,
    data.plaid_item_id || null,
    userId,
    id
  )
}

export async function deleteCreditCard(userId: number, id: number): Promise<void> {
  const db = getDb()
  await db.prepare('DELETE FROM budget_credit_cards WHERE user_id = ? AND id = ?').run(userId, id)
}

export async function clearCreditCardPlaid(userId: number, id: number): Promise<void> {
  const db = getDb()
  await db.prepare('UPDATE budget_credit_cards SET plaid_account_id = NULL, plaid_item_id = NULL, current_balance = 0 WHERE user_id = ? AND id = ?').run(userId, id)
}

export async function getBillsByCreditCard(userId: number, creditCardId: number): Promise<BudgetBill[]> {
  const db = getDb()
  return (await db.prepare('SELECT * FROM budget_bills WHERE user_id = ? AND credit_card_id = ? ORDER BY due_date').all(userId, creditCardId)) as BudgetBill[]
}

// Bills
export async function getBills(userId: number): Promise<BudgetBill[]> {
  const db = getDb()
  return (await db.prepare(`
    SELECT b.*, COALESCE(b.payee_name, p.name) as payee_name
    FROM budget_bills b
    LEFT JOIN budget_payees p ON b.payee_id = p.id
    WHERE b.user_id = ?
    ORDER BY b.due_date
  `).all(userId)) as BudgetBill[]
}

export async function getUnpaidBills(userId: number): Promise<BudgetBill[]> {
  const db = getDb()
  return (await db.prepare(`
    SELECT b.*, COALESCE(b.payee_name, p.name) as payee_name
    FROM budget_bills b
    LEFT JOIN budget_payees p ON b.payee_id = p.id
    WHERE b.user_id = ? AND b.is_paid = 0
    ORDER BY b.due_date
  `).all(userId)) as BudgetBill[]
}

export async function getBill(userId: number, id: number): Promise<BudgetBill | null> {
  const db = getDb()
  return ((await db.prepare('SELECT * FROM budget_bills WHERE user_id = ? AND id = ?').get(userId, id)) as BudgetBill | undefined) ?? null
}

export async function addBill(userId: number, data: Partial<BudgetBill>): Promise<number> {
  const db = getDb()
  const result = await db.prepare(
    'INSERT INTO budget_bills (user_id, payee_id, payee_name, amount, due_date, is_paid, paid_date, is_recurring, recurrence_type, notes, category_id, account, credit_card_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
  ).run(
    userId,
    data.payee_id || null,
    data.payee_name || '',
    data.amount || 0,
    data.due_date || '',
    data.is_paid || 0,
    data.paid_date || null,
    data.is_recurring || 0,
    data.recurrence_type || '',
    data.notes || '',
    data.category_id || null,
    data.account || '',
    data.credit_card_id || null
  )
  return Number(result.lastInsertRowid)
}

export async function updateBill(userId: number, id: number, data: Partial<BudgetBill>): Promise<void> {
  const db = getDb()
  await db.prepare(
    'UPDATE budget_bills SET payee_id = ?, payee_name = ?, amount = ?, due_date = ?, is_paid = ?, paid_date = ?, is_recurring = ?, recurrence_type = ?, notes = ?, category_id = ?, account = ?, credit_card_id = ? WHERE user_id = ? AND id = ?'
  ).run(
    data.payee_id || null,
    data.payee_name || '',
    data.amount || 0,
    data.due_date || '',
    data.is_paid || 0,
    data.paid_date || null,
    data.is_recurring || 0,
    data.recurrence_type || '',
    data.notes || '',
    data.category_id || null,
    data.account || '',
    data.credit_card_id || null,
    userId,
    id
  )
}

export async function updateBillField(userId: number, id: number, field: string, value: unknown): Promise<void> {
  const db = getDb()
  const allowedFields = ['payee_id', 'payee_name', 'amount', 'due_date', 'is_paid', 'paid_date', 'is_recurring', 'recurrence_type', 'notes', 'category_id', 'account', 'credit_card_id']
  if (!allowedFields.includes(field)) return
  await db.prepare(`UPDATE budget_bills SET ${field} = ? WHERE user_id = ? AND id = ?`).run(value, userId, id)
}

export async function markBillPaid(userId: number, id: number): Promise<void> {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]
  await db.prepare('UPDATE budget_bills SET is_paid = 1, paid_date = ? WHERE user_id = ? AND id = ?').run(today, userId, id)
}

export async function markBillUnpaid(userId: number, id: number): Promise<void> {
  const db = getDb()
  await db.prepare('UPDATE budget_bills SET is_paid = 0, paid_date = NULL WHERE user_id = ? AND id = ?').run(userId, id)
}

export async function deleteBill(userId: number, id: number): Promise<void> {
  const db = getDb()
  await db.prepare('DELETE FROM budget_bills WHERE user_id = ? AND id = ?').run(userId, id)
}

// Budget Categories
export async function getBudgetCategories(userId: number): Promise<BudgetCategory[]> {
  const db = getDb()
  return (await db.prepare('SELECT * FROM budget_categories WHERE user_id = ? ORDER BY parent_id, name').all(userId)) as BudgetCategory[]
}

export async function getBudgetCategory(userId: number, id: number): Promise<BudgetCategory | null> {
  const db = getDb()
  return ((await db.prepare('SELECT * FROM budget_categories WHERE user_id = ? AND id = ?').get(userId, id)) as BudgetCategory | undefined) ?? null
}

export async function getAllBudgetCategoriesFlat(userId: number): Promise<BudgetCategory[]> {
  const db = getDb()
  return (await db.prepare('SELECT * FROM budget_categories WHERE user_id = ? ORDER BY name').all(userId)) as BudgetCategory[]
}

export async function addBudgetCategory(userId: number, data: Partial<BudgetCategory>): Promise<number> {
  const db = getDb()
  const result = await db.prepare(
    'INSERT INTO budget_categories (user_id, name, monthly_limit, color, parent_id, actual_spent) VALUES (?, ?, ?, ?, ?, ?) RETURNING id'
  ).run(userId, data.name || '', data.monthly_limit || 0, data.color || '#2E7D32', data.parent_id || null, data.actual_spent || 0)
  return Number(result.lastInsertRowid)
}

export async function updateBudgetCategory(userId: number, id: number, data: Partial<BudgetCategory>): Promise<void> {
  const db = getDb()
  await db.prepare(
    'UPDATE budget_categories SET name = ?, monthly_limit = ?, color = ?, parent_id = ?, actual_spent = ? WHERE user_id = ? AND id = ?'
  ).run(data.name || '', data.monthly_limit || 0, data.color || '#2E7D32', data.parent_id || null, data.actual_spent || 0, userId, id)
}

export async function deleteBudgetCategory(userId: number, id: number): Promise<void> {
  const db = getDb()
  await db.prepare('DELETE FROM budget_categories WHERE user_id = ? AND id = ?').run(userId, id)
}

// Modified Income
export async function getModifiedIncomes(userId: number): Promise<BudgetModifiedIncome[]> {
  const db = getDb()
  return (await db.prepare('SELECT * FROM budget_modified_income WHERE user_id = ? ORDER BY entry_date DESC').all(userId)) as BudgetModifiedIncome[]
}

export async function addModifiedIncome(userId: number, data: Partial<BudgetModifiedIncome>): Promise<number> {
  const db = getDb()
  const result = await db.prepare(
    'INSERT INTO budget_modified_income (user_id, amount, entry_date, period_type, notes) VALUES (?, ?, ?, ?, ?) RETURNING id'
  ).run(userId, data.amount || 0, data.entry_date || '', data.period_type || 'biweekly', data.notes || '')
  return Number(result.lastInsertRowid)
}

export async function deleteModifiedIncome(userId: number, id: number): Promise<void> {
  const db = getDb()
  await db.prepare('DELETE FROM budget_modified_income WHERE user_id = ? AND id = ?').run(userId, id)
}

// Pay Period History
export async function getPayPeriodHistory(userId: number) {
  const db = getDb()
  const paychecks = (await db.prepare('SELECT * FROM budget_paychecks WHERE user_id = ? ORDER BY check_date DESC').all(userId)) as (BudgetPaycheck & { id: number })[]
  const periods: Record<string, { income: number; expenses: number; bills: BudgetBill[] }> = {}

  for (const pc of paychecks) {
    if (!pc.check_date) continue
    const periodKey = pc.check_date
    const nextPc = paychecks.find(p => p.check_date && p.check_date < periodKey)
    const periodEnd = nextPc ? nextPc.check_date : new Date().toISOString().split('T')[0]

    const bills = (await db.prepare(`
      SELECT b.*, COALESCE(b.payee_name, p.name) as payee_name
      FROM budget_bills b
      LEFT JOIN budget_payees p ON b.payee_id = p.id
      WHERE b.user_id = ? AND b.due_date >= ? AND b.due_date <= ?
      ORDER BY b.due_date
    `).all(userId, periodKey, periodEnd)) as BudgetBill[]

    const expenses = bills.reduce((s, b) => s + (Number(b.amount) || 0), 0)
    periods[periodKey] = {
      income: pc.net_pay || 0,
      expenses,
      bills
    }
  }

  return periods
}

// Transactions
export async function getTransactions(userId: number, accountId?: number, startDate?: string, endDate?: string) {
  const db = getDb()
  let sql = 'SELECT * FROM budget_transactions WHERE user_id = ?'
  const params: unknown[] = [userId]
  if (accountId) { sql += ' AND account_id = ?'; params.push(accountId) }
  if (startDate) { sql += ' AND date >= ?'; params.push(startDate) }
  if (endDate) { sql += ' AND date <= ?'; params.push(endDate) }
  sql += ' ORDER BY date DESC'
  return (await db.prepare(sql).all(...params)) as { id: number; user_id: number; account_id: number; date: string; description: string; amount: number; balance: number; plaid_transaction_id: string | null }[]
}

export async function addTransactions(userId: number, accountId: number, transactionsList: { date: string; description: string; amount: number; balance: number }[]) {
  const db = getDb()
  const insert = db.prepare('INSERT INTO budget_transactions (user_id, account_id, date, description, amount, balance) VALUES (?, ?, ?, ?, ?, ?)')
  let count = 0
  for (const tx of transactionsList) {
    if (tx.date && tx.amount !== 0) {
      await insert.run(userId, accountId, tx.date, tx.description, tx.amount, tx.balance || 0)
      count++
    }
  }
  return count
}

export async function clearTransactions(userId: number, accountId: number) {
  const db = getDb()
  await db.prepare('DELETE FROM budget_transactions WHERE user_id = ? AND account_id = ?').run(userId, accountId)
}

export async function deleteTransaction(userId: number, id: number) {
  const db = getDb()
  await db.prepare('DELETE FROM budget_transactions WHERE user_id = ? AND id = ?').run(userId, id)
}

export async function updateTransaction(userId: number, id: number, data: { date?: string; description?: string; amount?: number; balance?: number }) {
  const db = getDb()
  const sets: string[] = []
  const vals: unknown[] = []
  if (data.date !== undefined) { sets.push('date = ?'); vals.push(data.date) }
  if (data.description !== undefined) { sets.push('description = ?'); vals.push(data.description) }
  if (data.amount !== undefined) { sets.push('amount = ?'); vals.push(data.amount) }
  if (data.balance !== undefined) { sets.push('balance = ?'); vals.push(data.balance) }
  if (sets.length === 0) return
  vals.push(id, userId)
  await db.prepare(`UPDATE budget_transactions SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...vals)
}

export async function clearAllTransactions(userId: number) {
  const db = getDb()
  await db.prepare('DELETE FROM budget_transactions WHERE user_id = ?').run(userId)
}

// Plaid Items
export async function addPlaidItem(userId: number, accessToken: string, itemId: string, institutionName: string) {
  const db = getDb()
  const result = await db.prepare('INSERT INTO budget_plaid_items (user_id, access_token, item_id, institution_name) VALUES (?, ?, ?, ?) RETURNING id').run(userId, accessToken, itemId, institutionName)
  return Number(result.lastInsertRowid)
}

export async function getPlaidItems(userId: number) {
  const db = getDb()
  return (await db.prepare('SELECT * FROM budget_plaid_items WHERE user_id = ? ORDER BY id').all(userId)) as { id: number; user_id: number; access_token: string; item_id: string; institution_name: string; plaid_cursor: string | null }[]
}

export async function deletePlaidItem(userId: number, itemId: number) {
  const db = getDb()
  await db.prepare('DELETE FROM budget_plaid_items WHERE user_id = ? AND id = ?').run(userId, itemId)
  await db.prepare('UPDATE budget_bank_accounts SET plaid_account_id = NULL, plaid_item_id = NULL WHERE user_id = ? AND plaid_item_id = ?').run(userId, itemId)
  await db.prepare('UPDATE budget_credit_cards SET plaid_account_id = NULL, plaid_item_id = NULL WHERE user_id = ? AND plaid_item_id = ?').run(userId, itemId)
}

export async function updatePlaidCursor(userId: number, itemPk: number, cursorVal: string) {
  const db = getDb()
  await db.prepare('UPDATE budget_plaid_items SET plaid_cursor = ? WHERE user_id = ? AND id = ?').run(cursorVal, userId, itemPk)
}

export async function getAccountsByPlaidItem(userId: number, itemPk: number) {
  const db = getDb()
  const banks = (await db.prepare('SELECT id, plaid_account_id, name, current_balance FROM budget_bank_accounts WHERE user_id = ? AND plaid_item_id = ? AND is_active = 1').all(userId, itemPk)) as { id: number; plaid_account_id: string; name: string; current_balance: number }[]
  const cards = (await db.prepare('SELECT id, plaid_account_id, name, current_balance FROM budget_credit_cards WHERE user_id = ? AND plaid_item_id = ? AND is_active = 1').all(userId, itemPk)) as { id: number; plaid_account_id: string; name: string; current_balance: number }[]
  return [...banks.map(b => ({ ...b, type: 'bank' as const })), ...cards.map(c => ({ ...c, type: 'credit' as const }))]
}

export async function upsertPlaidTransaction(userId: number, localAccountId: number, plaidTxId: string, date: string, description: string, amount: number, runningBalance: number, isCreditCard: boolean = false) {
  const db = getDb()
  const existing = (await db.prepare('SELECT id FROM budget_transactions WHERE plaid_transaction_id = ?').get(plaidTxId)) as { id: number } | undefined
  if (existing) {
    await db.prepare('UPDATE budget_transactions SET date=?, description=?, amount=?, running_balance=? WHERE plaid_transaction_id=?').run(date, description, amount, runningBalance, plaidTxId)
  } else {
    await db.prepare('INSERT INTO budget_transactions (user_id, account_id, date, description, amount, balance, plaid_transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, localAccountId, date, description, amount, runningBalance, plaidTxId)
  }
}

export async function deletePlaidTransaction(plaidTxId: string) {
  const db = getDb()
  await db.prepare('DELETE FROM budget_transactions WHERE plaid_transaction_id = ?').run(plaidTxId)
}

// Dashboard stats helper: total budget
export async function getTotalBudget(userId: number): Promise<number> {
  const db = getDb()
  return (await db.prepare('SELECT COALESCE(SUM(monthly_limit), 0) as t FROM budget_categories WHERE user_id = ?').get(userId) as { t: number }).t
}

// Goals helper: get all debt accounts
export async function getDebtAccounts(userId: number) {
  const db = getDb()
  const creditCards = await db.prepare('SELECT id, name, current_balance as balance, interest_rate as rate FROM budget_credit_cards WHERE user_id = ? AND is_active = 1').all(userId)
  const loans = await db.prepare("SELECT id, name, current_balance as balance, interest_rate as rate FROM budget_bank_accounts WHERE user_id = ? AND is_active = 1 AND account_type = 'loan'").all(userId)
  return { creditCards, loans }
}

// Bills with payees (for interactive budget, reports, etc.)
export async function getBillsWithPayees(userId: number) {
  const db = getDb()
  return (await db.prepare(`
    SELECT b.*, COALESCE(b.payee_name, p.name) as payee_name
    FROM budget_bills b
    LEFT JOIN budget_payees p ON b.payee_id = p.id
    WHERE b.user_id = ?
    ORDER BY b.due_date
  `).all(userId)) as (BudgetBill & { payee_name: string })[]
}

export async function initBudgetDb(): Promise<void> {
  // No-op: schema managed by Postgres
}
