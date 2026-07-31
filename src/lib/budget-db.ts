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

    CREATE TABLE IF NOT EXISTS budget_modified_income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      entry_date TEXT NOT NULL,
      period_type TEXT NOT NULL DEFAULT 'biweekly',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS budget_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      balance REAL DEFAULT 0,
      plaid_transaction_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (account_id) REFERENCES budget_bank_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS budget_plaid_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      access_token TEXT NOT NULL,
      item_id TEXT,
      institution_name TEXT,
      plaid_cursor TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)

  const catCols = db.prepare('PRAGMA table_info(budget_categories)').all() as { name: string }[]
  if (!catCols.find(c => c.name === 'actual_spent')) {
    db.exec('ALTER TABLE budget_categories ADD COLUMN actual_spent REAL DEFAULT 0')
  }

  const baCols = db.prepare('PRAGMA table_info(budget_bank_accounts)').all() as { name: string }[]
  if (!baCols.find(c => c.name === 'plaid_account_id')) {
    db.exec('ALTER TABLE budget_bank_accounts ADD COLUMN plaid_account_id TEXT')
  }
  if (!baCols.find(c => c.name === 'plaid_item_id')) {
    db.exec('ALTER TABLE budget_bank_accounts ADD COLUMN plaid_item_id INTEGER')
  }

  const ccCols = db.prepare('PRAGMA table_info(budget_credit_cards)').all() as { name: string }[]
  if (!ccCols.find(c => c.name === 'plaid_account_id')) {
    db.exec('ALTER TABLE budget_credit_cards ADD COLUMN plaid_account_id TEXT')
  }
  if (!ccCols.find(c => c.name === 'plaid_item_id')) {
    db.exec('ALTER TABLE budget_credit_cards ADD COLUMN plaid_item_id INTEGER')
  }
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

  const totalIncomeAccounts = (db.prepare('SELECT COALESCE(SUM(current_balance), 0) as t FROM budget_bank_accounts WHERE user_id = ? AND is_active = 1 AND is_income_account = 1').get(userId) as { t: number }).t

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

  // Monthly expenses paid/due (30-day window)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]
  const todayStr = new Date().toISOString().split('T')[0]
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  const thirtyDaysFromNowStr = thirtyDaysFromNow.toISOString().split('T')[0]

  const monthlyExpensesPaid = (db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as t FROM budget_bills WHERE user_id = ? AND is_paid = 1 AND paid_date >= ? AND paid_date <= ?'
  ).get(userId, thirtyDaysAgoStr, todayStr) as { t: number }).t

  const monthlyExpensesDue = (db.prepare(
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
export function getPayees(userId: number): BudgetPayee[] {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_payees WHERE user_id = ? ORDER BY name').all(userId) as BudgetPayee[]
}

export function getPayee(userId: number, id: number): BudgetPayee | null {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_payees WHERE user_id = ? AND id = ?').get(userId, id) as BudgetPayee | undefined ?? null
}

export function addPayee(userId: number, data: Partial<BudgetPayee>): number {
  ensureSchemaOnce()
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO budget_payees (user_id, name, category, account_number, notes, website, default_category_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, data.name || '', data.category || '', data.account_number || '', data.notes || '', data.website || '', data.default_category_id || null)
  return Number(result.lastInsertRowid)
}

export function updatePayee(userId: number, id: number, data: Partial<BudgetPayee>): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare(
    'UPDATE budget_payees SET name = ?, category = ?, account_number = ?, notes = ?, website = ?, default_category_id = ? WHERE user_id = ? AND id = ?'
  ).run(data.name || '', data.category || '', data.account_number || '', data.notes || '', data.website || '', data.default_category_id || null, userId, id)
}

export function deletePayee(userId: number, id: number): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('DELETE FROM budget_payees WHERE user_id = ? AND id = ?').run(userId, id)
}

export function getPayeeByName(userId: number, name: string): BudgetPayee | null {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_payees WHERE user_id = ? AND name = ?').get(userId, name) as BudgetPayee | undefined ?? null
}

// Bank Accounts
export function getBankAccounts(userId: number): BudgetBankAccount[] {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_bank_accounts WHERE user_id = ? ORDER BY name').all(userId) as BudgetBankAccount[]
}

export function getBankAccount(userId: number, id: number): BudgetBankAccount | null {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_bank_accounts WHERE user_id = ? AND id = ?').get(userId, id) as BudgetBankAccount | undefined ?? null
}

export function addBankAccount(userId: number, data: Partial<BudgetBankAccount>): number {
  ensureSchemaOnce()
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO budget_bank_accounts (user_id, name, account_type, institution, account_number_last4, current_balance, website, is_active, is_income_account, interest_rate, plaid_account_id, plaid_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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

export function updateBankAccount(userId: number, id: number, data: Partial<BudgetBankAccount>): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare(
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

export function deleteBankAccount(userId: number, id: number): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('DELETE FROM budget_bank_accounts WHERE user_id = ? AND id = ?').run(userId, id)
}

export function updateBankAccountBalance(userId: number, id: number, balance: number): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('UPDATE budget_bank_accounts SET current_balance = ? WHERE user_id = ? AND id = ?').run(balance, userId, id)
}

export function clearBankAccountPlaid(userId: number, id: number): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('UPDATE budget_bank_accounts SET plaid_account_id = NULL, plaid_item_id = NULL, current_balance = 0 WHERE user_id = ? AND id = ?').run(userId, id)
  db.prepare('DELETE FROM budget_transactions WHERE user_id = ? AND account_id = ?').run(userId, id)
}

// Credit Cards
export function getCreditCards(userId: number): BudgetCreditCard[] {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_credit_cards WHERE user_id = ? ORDER BY name').all(userId) as BudgetCreditCard[]
}

export function getCreditCard(userId: number, id: number): BudgetCreditCard | null {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_credit_cards WHERE user_id = ? AND id = ?').get(userId, id) as BudgetCreditCard | undefined ?? null
}

export function addCreditCard(userId: number, data: Partial<BudgetCreditCard>): number {
  ensureSchemaOnce()
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO budget_credit_cards (user_id, name, last_four, credit_limit, current_balance, interest_rate, due_date, website, is_active, plaid_account_id, plaid_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    userId,
    data.name || '',
    data.last_four || '',
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

export function updateCreditCard(userId: number, id: number, data: Partial<BudgetCreditCard>): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare(
    'UPDATE budget_credit_cards SET name = ?, last_four = ?, credit_limit = ?, current_balance = ?, interest_rate = ?, due_date = ?, website = ?, is_active = ?, plaid_account_id = ?, plaid_item_id = ? WHERE user_id = ? AND id = ?'
  ).run(
    data.name || '',
    data.last_four || '',
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

export function deleteCreditCard(userId: number, id: number): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('DELETE FROM budget_credit_cards WHERE user_id = ? AND id = ?').run(userId, id)
}

export function clearCreditCardPlaid(userId: number, id: number): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('UPDATE budget_credit_cards SET plaid_account_id = NULL, plaid_item_id = NULL, current_balance = 0 WHERE user_id = ? AND id = ?').run(userId, id)
}

export function getBillsByCreditCard(userId: number, creditCardId: number): BudgetBill[] {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_bills WHERE user_id = ? AND credit_card_id = ? ORDER BY due_date').all(userId, creditCardId) as BudgetBill[]
}

// Bills
export function getBills(userId: number): BudgetBill[] {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare(`
    SELECT b.*, COALESCE(b.payee_name, p.name) as payee_name
    FROM budget_bills b
    LEFT JOIN budget_payees p ON b.payee_id = p.id
    WHERE b.user_id = ?
    ORDER BY b.due_date
  `).all(userId) as BudgetBill[]
}

export function getUnpaidBills(userId: number): BudgetBill[] {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare(`
    SELECT b.*, COALESCE(b.payee_name, p.name) as payee_name
    FROM budget_bills b
    LEFT JOIN budget_payees p ON b.payee_id = p.id
    WHERE b.user_id = ? AND b.is_paid = 0
    ORDER BY b.due_date
  `).all(userId) as BudgetBill[]
}

export function getBill(userId: number, id: number): BudgetBill | null {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_bills WHERE user_id = ? AND id = ?').get(userId, id) as BudgetBill | undefined ?? null
}

export function addBill(userId: number, data: Partial<BudgetBill>): number {
  ensureSchemaOnce()
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO budget_bills (user_id, payee_id, payee_name, amount, due_date, is_paid, paid_date, is_recurring, recurrence_type, notes, category_id, account, credit_card_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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

export function updateBill(userId: number, id: number, data: Partial<BudgetBill>): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare(
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

export function updateBillField(userId: number, id: number, field: string, value: unknown): void {
  ensureSchemaOnce()
  const db = getDb()
  const allowedFields = ['payee_id', 'payee_name', 'amount', 'due_date', 'is_paid', 'paid_date', 'is_recurring', 'recurrence_type', 'notes', 'category_id', 'account', 'credit_card_id']
  if (!allowedFields.includes(field)) return
  db.prepare(`UPDATE budget_bills SET ${field} = ? WHERE user_id = ? AND id = ?`).run(value, userId, id)
}

export function markBillPaid(userId: number, id: number): void {
  ensureSchemaOnce()
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]
  db.prepare('UPDATE budget_bills SET is_paid = 1, paid_date = ? WHERE user_id = ? AND id = ?').run(today, userId, id)
}

export function markBillUnpaid(userId: number, id: number): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('UPDATE budget_bills SET is_paid = 0, paid_date = NULL WHERE user_id = ? AND id = ?').run(userId, id)
}

export function deleteBill(userId: number, id: number): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('DELETE FROM budget_bills WHERE user_id = ? AND id = ?').run(userId, id)
}

// Budget Categories
export function getBudgetCategories(userId: number): BudgetCategory[] {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_categories WHERE user_id = ? ORDER BY parent_id, name').all(userId) as BudgetCategory[]
}

export function getBudgetCategory(userId: number, id: number): BudgetCategory | null {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_categories WHERE user_id = ? AND id = ?').get(userId, id) as BudgetCategory | undefined ?? null
}

export function getAllBudgetCategoriesFlat(userId: number): BudgetCategory[] {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_categories WHERE user_id = ? ORDER BY name').all(userId) as BudgetCategory[]
}

export function addBudgetCategory(userId: number, data: Partial<BudgetCategory>): number {
  ensureSchemaOnce()
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO budget_categories (user_id, name, monthly_limit, color, parent_id, actual_spent) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, data.name || '', data.monthly_limit || 0, data.color || '#2E7D32', data.parent_id || null, data.actual_spent || 0)
  return Number(result.lastInsertRowid)
}

export function updateBudgetCategory(userId: number, id: number, data: Partial<BudgetCategory>): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare(
    'UPDATE budget_categories SET name = ?, monthly_limit = ?, color = ?, parent_id = ?, actual_spent = ? WHERE user_id = ? AND id = ?'
  ).run(data.name || '', data.monthly_limit || 0, data.color || '#2E7D32', data.parent_id || null, data.actual_spent || 0, userId, id)
}

export function deleteBudgetCategory(userId: number, id: number): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('DELETE FROM budget_categories WHERE user_id = ? AND id = ?').run(userId, id)
}

// Modified Income
export function getModifiedIncomes(userId: number): BudgetModifiedIncome[] {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_modified_income WHERE user_id = ? ORDER BY entry_date DESC').all(userId) as BudgetModifiedIncome[]
}

export function addModifiedIncome(userId: number, data: Partial<BudgetModifiedIncome>): number {
  ensureSchemaOnce()
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO budget_modified_income (user_id, amount, entry_date, period_type, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, data.amount || 0, data.entry_date || '', data.period_type || 'biweekly', data.notes || '')
  return Number(result.lastInsertRowid)
}

export function deleteModifiedIncome(userId: number, id: number): void {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('DELETE FROM budget_modified_income WHERE user_id = ? AND id = ?').run(userId, id)
}

// Pay Period History
export function getPayPeriodHistory(userId: number) {
  ensureSchemaOnce()
  const db = getDb()
  const paychecks = db.prepare('SELECT * FROM budget_paychecks WHERE user_id = ? ORDER BY check_date DESC').all(userId) as (BudgetPaycheck & { id: number })[]
  const periods: Record<string, { income: number; expenses: number; bills: BudgetBill[] }> = {}
  
  for (const pc of paychecks) {
    if (!pc.check_date) continue
    const periodKey = pc.check_date
    const nextPc = paychecks.find(p => p.check_date && p.check_date < periodKey)
    const periodEnd = nextPc ? nextPc.check_date : new Date().toISOString().split('T')[0]
    
    const bills = db.prepare(`
      SELECT b.*, COALESCE(b.payee_name, p.name) as payee_name
      FROM budget_bills b
      LEFT JOIN budget_payees p ON b.payee_id = p.id
      WHERE b.user_id = ? AND b.due_date >= ? AND b.due_date <= ?
      ORDER BY b.due_date
    `).all(userId, periodKey, periodEnd) as BudgetBill[]
    
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
export function getTransactions(userId: number, accountId?: number, startDate?: string, endDate?: string) {
  ensureSchemaOnce()
  const db = getDb()
  let sql = 'SELECT * FROM budget_transactions WHERE user_id = ?'
  const params: unknown[] = [userId]
  if (accountId) { sql += ' AND account_id = ?'; params.push(accountId) }
  if (startDate) { sql += ' AND date >= ?'; params.push(startDate) }
  if (endDate) { sql += ' AND date <= ?'; params.push(endDate) }
  sql += ' ORDER BY date DESC'
  return db.prepare(sql).all(...params) as { id: number; user_id: number; account_id: number; date: string; description: string; amount: number; balance: number; plaid_transaction_id: string | null }[]
}

export function addTransactions(userId: number, accountId: number, transactionsList: { date: string; description: string; amount: number; balance: number }[]) {
  ensureSchemaOnce()
  const db = getDb()
  const insert = db.prepare('INSERT INTO budget_transactions (user_id, account_id, date, description, amount, balance) VALUES (?, ?, ?, ?, ?, ?)')
  let count = 0
  for (const tx of transactionsList) {
    if (tx.date && tx.amount !== 0) {
      insert.run(userId, accountId, tx.date, tx.description, tx.amount, tx.balance || 0)
      count++
    }
  }
  return count
}

export function clearTransactions(userId: number, accountId: number) {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('DELETE FROM budget_transactions WHERE user_id = ? AND account_id = ?').run(userId, accountId)
}

export function deleteTransaction(userId: number, id: number) {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('DELETE FROM budget_transactions WHERE user_id = ? AND id = ?').run(userId, id)
}

export function updateTransaction(userId: number, id: number, data: { date?: string; description?: string; amount?: number; balance?: number }) {
  ensureSchemaOnce()
  const db = getDb()
  const sets: string[] = []
  const vals: unknown[] = []
  if (data.date !== undefined) { sets.push('date = ?'); vals.push(data.date) }
  if (data.description !== undefined) { sets.push('description = ?'); vals.push(data.description) }
  if (data.amount !== undefined) { sets.push('amount = ?'); vals.push(data.amount) }
  if (data.balance !== undefined) { sets.push('balance = ?'); vals.push(data.balance) }
  if (sets.length === 0) return
  vals.push(id, userId)
  db.prepare(`UPDATE budget_transactions SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...vals)
}

export function clearAllTransactions(userId: number) {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('DELETE FROM budget_transactions WHERE user_id = ?').run(userId)
}

// Plaid Items
export function addPlaidItem(userId: number, accessToken: string, itemId: string, institutionName: string) {
  ensureSchemaOnce()
  const db = getDb()
  const result = db.prepare('INSERT INTO budget_plaid_items (user_id, access_token, item_id, institution_name) VALUES (?, ?, ?, ?)').run(userId, accessToken, itemId, institutionName)
  return Number(result.lastInsertRowid)
}

export function getPlaidItems(userId: number) {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare('SELECT * FROM budget_plaid_items WHERE user_id = ? ORDER BY id').all(userId) as { id: number; user_id: number; access_token: string; item_id: string; institution_name: string; plaid_cursor: string | null }[]
}

export function deletePlaidItem(userId: number, itemId: number) {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('DELETE FROM budget_plaid_items WHERE user_id = ? AND id = ?').run(userId, itemId)
  db.prepare('UPDATE budget_bank_accounts SET plaid_account_id = NULL, plaid_item_id = NULL WHERE user_id = ? AND plaid_item_id = ?').run(userId, itemId)
  db.prepare('UPDATE budget_credit_cards SET plaid_account_id = NULL, plaid_item_id = NULL WHERE user_id = ? AND plaid_item_id = ?').run(userId, itemId)
}

export function updatePlaidCursor(userId: number, itemPk: number, cursorVal: string) {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('UPDATE budget_plaid_items SET plaid_cursor = ? WHERE user_id = ? AND id = ?').run(cursorVal, userId, itemPk)
}

export function getAccountsByPlaidItem(userId: number, itemPk: number) {
  ensureSchemaOnce()
  const db = getDb()
  const banks = db.prepare('SELECT id, plaid_account_id, name, current_balance FROM budget_bank_accounts WHERE user_id = ? AND plaid_item_id = ? AND is_active = 1').all(userId, itemPk) as { id: number; plaid_account_id: string; name: string; current_balance: number }[]
  const cards = db.prepare('SELECT id, plaid_account_id, name, current_balance FROM budget_credit_cards WHERE user_id = ? AND plaid_item_id = ? AND is_active = 1').all(userId, itemPk) as { id: number; plaid_account_id: string; name: string; current_balance: number }[]
  return [...banks.map(b => ({ ...b, type: 'bank' as const })), ...cards.map(c => ({ ...c, type: 'credit' as const }))]
}

export function upsertPlaidTransaction(userId: number, localAccountId: number, plaidTxId: string, date: string, description: string, amount: number, runningBalance: number, isCreditCard: boolean = false) {
  ensureSchemaOnce()
  const db = getDb()
  const existing = db.prepare('SELECT id FROM budget_transactions WHERE plaid_transaction_id = ?').get(plaidTxId) as { id: number } | undefined
  if (existing) {
    db.prepare('UPDATE budget_transactions SET date=?, description=?, amount=?, running_balance=? WHERE plaid_transaction_id=?').run(date, description, amount, runningBalance, plaidTxId)
  } else {
    db.prepare('INSERT INTO budget_transactions (user_id, account_id, date, description, amount, balance, plaid_transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, localAccountId, date, description, amount, runningBalance, plaidTxId)
  }
}

export function deletePlaidTransaction(plaidTxId: string) {
  ensureSchemaOnce()
  const db = getDb()
  db.prepare('DELETE FROM budget_transactions WHERE plaid_transaction_id = ?').run(plaidTxId)
}

// Dashboard stats helper: total budget
export function getTotalBudget(userId: number): number {
  ensureSchemaOnce()
  const db = getDb()
  return (db.prepare('SELECT COALESCE(SUM(monthly_limit), 0) as t FROM budget_categories WHERE user_id = ?').get(userId) as { t: number }).t
}

// Goals helper: get all debt accounts
export function getDebtAccounts(userId: number) {
  ensureSchemaOnce()
  const db = getDb()
  const creditCards = db.prepare('SELECT id, name, current_balance as balance, interest_rate as rate FROM budget_credit_cards WHERE user_id = ? AND is_active = 1').all(userId)
  const loans = db.prepare("SELECT id, name, current_balance as balance, interest_rate as rate FROM budget_bank_accounts WHERE user_id = ? AND is_active = 1 AND account_type = 'loan'").all(userId)
  return { creditCards, loans }
}

// Bills with payees (for interactive budget, reports, etc.)
export function getBillsWithPayees(userId: number) {
  ensureSchemaOnce()
  const db = getDb()
  return db.prepare(`
    SELECT b.*, COALESCE(b.payee_name, p.name) as payee_name
    FROM budget_bills b
    LEFT JOIN budget_payees p ON b.payee_id = p.id
    WHERE b.user_id = ?
    ORDER BY b.due_date
  `).all(userId) as (BudgetBill & { payee_name: string })[]
}

export function initBudgetDb(): void {
  ensureSchemaOnce()
}
