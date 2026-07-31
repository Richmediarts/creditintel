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
  federal_filing_status?: string
  state_filing_status?: string
  bank_name?: string
  account_number?: string
  deposit_amount?: number
  bank2_name?: string
  account2_number?: string
  deposit2_amount?: number
  notes?: string
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
  'spousal_life', 'employer_match', 'federal_filing_status', 'state_filing_status',
  'bank_name', 'account_number', 'deposit_amount', 'bank2_name', 'account2_number',
  'deposit2_amount', 'notes',
] as const

export interface BudgetStats {
  total_bank: number
  total_credit: number
  total_income: number
  last_paycheck_net: number
  total_expenses: number
  bills_before_next_pay: Array<{ id: number; payee_name?: string; amount: number; due_date: string }>
  bills_before_next_pay_total: number
  next_paycheck_date: string | null
  remaining: number
  upcoming_bills: Array<{ id: number; payee_name?: string; amount: number; due_date: string; is_paid: number }>
  last_paycheck: (BudgetPaycheck & { id: number }) | null
  last_paycheck_date: string | null
  biweekly_income: number
  biweekly_expenses: number
  biweekly_remaining: number
  monthly_income: number
  monthly_expenses: number
  monthly_remaining: number
}

function ensureBudgetSchema(): void {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS budget_paychecks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      pay_date TEXT, pay_period_begin TEXT, pay_period_end TEXT,
      check_date TEXT, check_number TEXT, employee_name TEXT, employee_id TEXT,
      company TEXT, hours_worked REAL DEFAULT 0, gross_pay REAL DEFAULT 0,
      pre_tax_deductions REAL DEFAULT 0, employee_taxes REAL DEFAULT 0,
      post_tax_deductions REAL DEFAULT 0, net_pay REAL DEFAULT 0,
      salary REAL DEFAULT 0, biometric_credit REAL DEFAULT 0,
      floating_holiday REAL DEFAULT 0, holiday_pay REAL DEFAULT 0,
      vacation_pay REAL DEFAULT 0, group_term_life REAL DEFAULT 0,
      spousal_biometric REAL DEFAULT 0, other_earnings REAL DEFAULT 0,
      oasdi REAL DEFAULT 0, medicare REAL DEFAULT 0, federal_tax REAL DEFAULT 0,
      state_tax REAL DEFAULT 0, state_name TEXT, social_security REAL DEFAULT 0,
      retirement_401k REAL DEFAULT 0, add_insurance REAL DEFAULT 0,
      dental_plan REAL DEFAULT 0, eye_plan REAL DEFAULT 0,
      health_care_fsa REAL DEFAULT 0, health_insurance REAL DEFAULT 0,
      optional_life REAL DEFAULT 0, hsa REAL DEFAULT 0,
      loan_repayment REAL DEFAULT 0, dependent_life REAL DEFAULT 0,
      stock_purchase REAL DEFAULT 0, spousal_life REAL DEFAULT 0,
      employer_match REAL DEFAULT 0, federal_filing_status TEXT,
      state_filing_status TEXT, bank_name TEXT, account_number TEXT,
      deposit_amount REAL DEFAULT 0, bank2_name TEXT, account2_number TEXT,
      deposit2_amount REAL DEFAULT 0, notes TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS budget_bank_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      institution TEXT,
      account_number_last4 TEXT,
      current_balance REAL DEFAULT 0,
      website TEXT,
      is_active INTEGER DEFAULT 1,
      is_income_account INTEGER DEFAULT 0,
      interest_rate REAL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS budget_credit_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      last_four TEXT,
      credit_limit REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      interest_rate REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      website TEXT,
      due_date TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS budget_payees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      account_number TEXT,
      notes TEXT,
      website TEXT,
      default_category_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS budget_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      payee_id INTEGER,
      payee_name TEXT,
      amount REAL DEFAULT 0,
      due_date TEXT NOT NULL,
      is_paid INTEGER DEFAULT 0,
      paid_date TEXT,
      is_recurring INTEGER DEFAULT 0,
      recurrence_type TEXT,
      notes TEXT,
      category_id INTEGER,
      account TEXT,
      credit_card_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS budget_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      monthly_limit REAL DEFAULT 0,
      color TEXT DEFAULT '#2E7D32',
      parent_id INTEGER DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)
}

function ensureSchemaOnce(): void {
  ensureBudgetSchema()
}

export function getPaychecks(userId: number): (BudgetPaycheck & { id: number })[] {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_paychecks WHERE user_id = ? ORDER BY check_date DESC, pay_date DESC').all(userId) as (BudgetPaycheck & { id: number })[]
}

export function getPaycheck(userId: number, id: number): (BudgetPaycheck & { id: number }) | null {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_paychecks WHERE user_id = ? AND id = ?').get(userId, id) as (BudgetPaycheck & { id: number }) | undefined ?? null
}

export function addPaycheck(userId: number, data: Partial<BudgetPaycheck>): number {
  ensureSchemaOnce()
  const db = getDb()
  const cols = [...PAYCHECK_COLUMNS]
  const values = cols.map((c) => {
    const v = (data as Record<string, unknown>)[c]
    if (v === undefined || v === null || v === '') {
      return NUMERIC_COLUMNS.has(c) ? 0 : ''
    }
    return NUMERIC_COLUMNS.has(c) ? Number(v) : String(v)
  })
  const placeholders = cols.map(() => '?').join(', ')
  const result = db.prepare(
    `INSERT INTO budget_paychecks (user_id, ${cols.join(', ')}) VALUES (?, ${placeholders})`
  ).run(userId, ...values)
  return Number(result.lastInsertRowid)
}

export function updatePaycheck(userId: number, id: number, data: Partial<BudgetPaycheck>): void {
  ensureSchemaOnce()
  const db = getDb()
  const setClauses: string[] = []
  const values: unknown[] = []
  for (const c of PAYCHECK_COLUMNS) {
    if ((data as Record<string, unknown>)[c] !== undefined) {
      const v = (data as Record<string, unknown>)[c]
      setClauses.push(`${c} = ?`)
      values.push(v === null || v === '' ? (NUMERIC_COLUMNS.has(c) ? 0 : '') : NUMERIC_COLUMNS.has(c) ? Number(v) : String(v))
    }
  }
  if (setClauses.length === 0) return
  values.push(id, userId)
  db.prepare(`UPDATE budget_paychecks SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`).run(...values)
}

export function deletePaycheck(userId: number, id: number): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('DELETE FROM budget_paychecks WHERE user_id = ? AND id = ?').run(userId, id)
}

const NUMERIC_COLUMNS = new Set<string>([
  'hours_worked', 'gross_pay', 'pre_tax_deductions', 'employee_taxes', 'post_tax_deductions',
  'net_pay', 'salary', 'biometric_credit', 'floating_holiday', 'holiday_pay', 'vacation_pay',
  'group_term_life', 'spousal_biometric', 'other_earnings', 'oasdi', 'medicare', 'federal_tax',
  'state_tax', 'social_security', 'retirement_401k', 'add_insurance', 'dental_plan', 'eye_plan',
  'health_care_fsa', 'health_insurance', 'optional_life', 'hsa', 'loan_repayment', 'dependent_life',
  'stock_purchase', 'spousal_life', 'employer_match', 'deposit_amount', 'deposit2_amount',
])

export function getNextPaycheckDate(userId: number): string | null {
  const paychecks = getPaychecks(userId)
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

export function getBudgetStats(userId: number): BudgetStats {
  ensureSchemaOnce()
  const db = getDb()

  const totalBank = (db.prepare('SELECT COALESCE(SUM(current_balance), 0) as t FROM budget_bank_accounts WHERE user_id = ? AND is_active = 1').get(userId) as { t: number }).t
  const totalCredit = (db.prepare('SELECT COALESCE(SUM(current_balance), 0) as t FROM budget_credit_cards WHERE user_id = ? AND is_active = 1').get(userId) as { t: number }).t

  const lastPaycheckRow = db.prepare(
    'SELECT * FROM budget_paychecks WHERE user_id = ? ORDER BY check_date DESC, pay_date DESC LIMIT 1'
  ).get(userId) as (BudgetPaycheck & { id: number }) | undefined
  const lastPaycheckNet = lastPaycheckRow?.net_pay || 0
  const lastPaycheckDate = lastPaycheckRow?.check_date || lastPaycheckRow?.pay_date || null

  const nextPaycheck = getNextPaycheckDate(userId)

  let totalExpensesPaid = 0
  if (nextPaycheck && lastPaycheckDate) {
    totalExpensesPaid = (db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as t FROM budget_bills WHERE user_id = ? AND is_paid = 1 AND paid_date >= ? AND paid_date <= ?'
    ).get(userId, lastPaycheckDate, nextPaycheck) as { t: number }).t
  } else {
    totalExpensesPaid = (db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as t FROM budget_bills WHERE user_id = ? AND is_paid = 1'
    ).get(userId) as { t: number }).t
  }

  let billsBeforeNextPay: BudgetStats['bills_before_next_pay'] = []
  let billsBeforeNextPayTotal = 0
  if (nextPaycheck) {
    billsBeforeNextPay = db.prepare(`
      SELECT b.id, COALESCE(b.payee_name, p.name) as payee_name, b.amount, b.due_date
      FROM budget_bills b
      LEFT JOIN budget_payees p ON b.payee_id = p.id
      WHERE b.user_id = ? AND b.is_paid = 0 AND b.due_date <= ?
      ORDER BY b.due_date ASC
    `).all(userId, nextPaycheck) as BudgetStats['bills_before_next_pay']
    billsBeforeNextPayTotal = billsBeforeNextPay.reduce((s, b) => s + (Number(b.amount) || 0), 0)
  }

  const upcomingBills = db.prepare(`
    SELECT b.id, COALESCE(b.payee_name, p.name) as payee_name, b.amount, b.due_date, b.is_paid
    FROM budget_bills b
    LEFT JOIN budget_payees p ON b.payee_id = p.id
    WHERE b.user_id = ? AND b.is_paid = 0
    ORDER BY b.due_date ASC LIMIT 5
  `).all(userId) as BudgetStats['upcoming_bills']

  const totalExpenses = totalExpensesPaid + billsBeforeNextPayTotal

  const biweeklyIncome = lastPaycheckNet
  const totalBudget = (db.prepare('SELECT COALESCE(SUM(monthly_limit), 0) as t FROM budget_categories WHERE user_id = ?').get(userId) as { t: number }).t
  const biweeklyExpenses = totalBudget ? totalBudget / 2 : 0
  const biweeklyRemaining = biweeklyIncome - biweeklyExpenses
  const monthlyIncome = lastPaycheckNet ? lastPaycheckNet * 26 / 12 : 0
  const monthlyExpenses = totalBudget
  const monthlyRemaining = monthlyIncome - monthlyExpenses

  return {
    total_bank: totalBank,
    total_credit: totalCredit,
    total_income: totalBank + lastPaycheckNet,
    last_paycheck_net: lastPaycheckNet,
    total_expenses: totalExpenses,
    bills_before_next_pay: billsBeforeNextPay,
    bills_before_next_pay_total: billsBeforeNextPayTotal,
    next_paycheck_date: nextPaycheck,
    remaining: totalBank + lastPaycheckNet - totalExpenses,
    upcoming_bills: upcomingBills,
    last_paycheck: lastPaycheckRow || null,
    last_paycheck_date: lastPaycheckDate,
    biweekly_income: biweeklyIncome,
    biweekly_expenses: biweeklyExpenses,
    biweekly_remaining: biweeklyRemaining,
    monthly_income: monthlyIncome,
    monthly_expenses: monthlyExpenses,
    monthly_remaining: monthlyRemaining,
  }
}

export function initBudgetDb(): void {
  ensureSchemaOnce()
}
