import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_DIR = process.env.VERCEL
  ? '/tmp/credit-dashboard'
  : path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'credit-dashboard.db')

let db: Database.Database | null = null

function seedFromFile(): void {
  const seedPath = path.join(process.cwd(), 'seed', 'seed.json')
  if (!fs.existsSync(seedPath)) return

  const userCount = (db!.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c
  if (userCount > 0) return

  try {
    const raw = fs.readFileSync(seedPath, 'utf-8')
    const seed = JSON.parse(raw)

    const insertUser = db!.prepare(
      'INSERT OR IGNORE INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const insertReport = db!.prepare(
      'INSERT OR IGNORE INTO reports (user_id, bureau, data, updated_at) VALUES (?, ?, ?, ?)'
    )
    const insertDispute = db!.prepare(
      'INSERT OR IGNORE INTO disputes (id, user_id, creditor_name, bureau, inaccuracies, status, filed_date, expected_response_date, resolved_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )

    const transaction = db!.transaction(() => {
      for (const u of seed.users) {
        insertUser.run(u.id, u.name, u.email, u.password_hash, u.role, u.created_at)
      }
      for (const r of seed.reports) {
        insertReport.run(r.user_id, r.bureau, r.data, r.updated_at)
      }
      // Don't seed fico_scores — each user enters their own scores via the FICO page
      for (const d of seed.disputes) {
        insertDispute.run(d.id, d.user_id, d.creditor_name, d.bureau, d.inaccuracies, d.status, d.filed_date, d.expected_response_date, d.resolved_date, d.notes, d.created_at, d.updated_at)
      }

      // Seed budget tables
      const budgetTables: Record<string, string[]> = {
        budget_paychecks: ['user_id','pay_date','pay_period_begin','pay_period_end','check_date','check_number','employee_name','employee_id','company','hours_worked','gross_pay','pre_tax_deductions','employee_taxes','post_tax_deductions','net_pay','salary','biometric_credit','floating_holiday','holiday_pay','vacation_pay','group_term_life','spousal_biometric','other_earnings','oasdi','medicare','federal_tax','state_tax','state_name','social_security','retirement_401k','add_insurance','dental_plan','eye_plan','health_care_fsa','health_insurance','optional_life','hsa','loan_repayment','dependent_life','stock_purchase','spousal_life','employer_match','employer_hsa','federal_filing_status','state_filing_status','federal_allowances','dependent_amount','additional_withholding','bank_name','account_number','deposit_amount','bank2_name','account2_number','deposit2_amount','notes','gross_pay_ytd','pre_tax_deductions_ytd','employee_taxes_ytd','post_tax_deductions_ytd','net_pay_ytd','hours_worked_ytd','retirement_401k_ytd','health_insurance_ytd','dental_plan_ytd','eye_plan_ytd','health_care_fsa_ytd','optional_life_ytd','add_insurance_ytd','federal_tax_ytd','state_tax_ytd','oasdi_ytd','medicare_ytd','employer_match_ytd','hsa_ytd','loan_repayment_ytd','dependent_life_ytd','stock_purchase_ytd','spousal_life_ytd','biometric_credit_ytd','spousal_biometric_ytd','group_term_life_ytd','floating_holiday_ytd','holiday_pay_ytd','vacation_pay_ytd','salary_ytd'],
        budget_bank_accounts: ['user_id','name','account_type','institution','account_number_last4','current_balance','website','is_active','is_income_account','interest_rate','plaid_account_id','plaid_item_id'],
        budget_credit_cards: ['user_id','name','last_four','credit_limit','current_balance','interest_rate','is_active','website','due_date','plaid_account_id','plaid_item_id'],
        budget_payees: ['user_id','name','category','account_number','notes','website','default_category_id'],
        budget_bills: ['user_id','payee_id','payee_name','amount','due_date','is_paid','paid_date','is_recurring','recurrence_type','notes','category_id','account','credit_card_id'],
        budget_categories: ['user_id','name','monthly_limit','color','parent_id','actual_spent'],
        budget_transactions: ['user_id','account_id','date','description','amount','balance','plaid_transaction_id'],
        budget_plaid_items: ['user_id','access_token','item_id','institution_name','plaid_cursor'],
        budget_modified_income: ['user_id','amount','entry_date','period_type','notes'],
      }

      for (const [table, cols] of Object.entries(budgetTables)) {
        const rows = seed[table]
        if (!rows || rows.length === 0) continue
        const placeholders = cols.map(() => '?').join(', ')
        const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
        const stmt = db!.prepare(sql)
        for (const row of rows) {
          const values = cols.map(c => row[c] !== undefined ? row[c] : null)
          stmt.run(...values)
        }
      }
    })
    transaction()
  } catch (e) {
    console.error('Seed failed:', e)
  }
}

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
    seedFromFile()
  }
  return db
}

function initSchema(): void {
  db!.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      address TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      creditor_name TEXT NOT NULL,
      bureau TEXT NOT NULL,
      inaccuracies TEXT,
      status TEXT NOT NULL DEFAULT 'not_filed',
      filed_date TEXT,
      expected_response_date TEXT,
      resolved_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

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
      employer_match REAL DEFAULT 0, employer_hsa REAL DEFAULT 0,
      federal_filing_status TEXT, state_filing_status TEXT,
      federal_allowances REAL DEFAULT 0, dependent_amount REAL DEFAULT 0,
      additional_withholding REAL DEFAULT 0,
      bank_name TEXT, account_number TEXT,
      deposit_amount REAL DEFAULT 0, bank2_name TEXT, account2_number TEXT,
      deposit2_amount REAL DEFAULT 0, notes TEXT,
      gross_pay_ytd REAL DEFAULT 0, pre_tax_deductions_ytd REAL DEFAULT 0,
      employee_taxes_ytd REAL DEFAULT 0, post_tax_deductions_ytd REAL DEFAULT 0,
      net_pay_ytd REAL DEFAULT 0, hours_worked_ytd REAL DEFAULT 0,
      retirement_401k_ytd REAL DEFAULT 0, health_insurance_ytd REAL DEFAULT 0,
      dental_plan_ytd REAL DEFAULT 0, eye_plan_ytd REAL DEFAULT 0,
      health_care_fsa_ytd REAL DEFAULT 0, optional_life_ytd REAL DEFAULT 0,
      add_insurance_ytd REAL DEFAULT 0, federal_tax_ytd REAL DEFAULT 0,
      state_tax_ytd REAL DEFAULT 0, oasdi_ytd REAL DEFAULT 0,
      medicare_ytd REAL DEFAULT 0, employer_match_ytd REAL DEFAULT 0,
      hsa_ytd REAL DEFAULT 0, loan_repayment_ytd REAL DEFAULT 0,
      dependent_life_ytd REAL DEFAULT 0, stock_purchase_ytd REAL DEFAULT 0,
      spousal_life_ytd REAL DEFAULT 0, biometric_credit_ytd REAL DEFAULT 0,
      spousal_biometric_ytd REAL DEFAULT 0, group_term_life_ytd REAL DEFAULT 0,
      floating_holiday_ytd REAL DEFAULT 0, holiday_pay_ytd REAL DEFAULT 0,
      vacation_pay_ytd REAL DEFAULT 0, salary_ytd REAL DEFAULT 0,
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
      plaid_account_id TEXT,
      plaid_item_id INTEGER,
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
      plaid_account_id TEXT,
      plaid_item_id INTEGER,
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
      color TEXT DEFAULT '#6366f1',
      parent_id INTEGER,
      actual_spent REAL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS budget_modified_income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL DEFAULT 0,
      entry_date TEXT,
      period_type TEXT DEFAULT 'biweekly',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)

  migrateSchema()
}

function migrateSchema(): void {
  const userColumns = db!.prepare("PRAGMA table_info('users')").all() as { name: string }[]
  const userColNames = userColumns.map(c => c.name)

  if (!userColNames.includes('reset_token')) {
    db!.exec("ALTER TABLE users ADD COLUMN reset_token TEXT")
  }
  if (!userColNames.includes('reset_token_expiry')) {
    db!.exec("ALTER TABLE users ADD COLUMN reset_token_expiry TEXT")
  }

  const disputeColumns = db!.prepare("PRAGMA table_info('disputes')").all() as { name: string }[]
  const disputeColNames = disputeColumns.map(c => c.name)

  if (!disputeColNames.includes('letter_type')) {
    db!.exec("ALTER TABLE disputes ADD COLUMN letter_type TEXT NOT NULL DEFAULT 'validation'")
  }
  if (!disputeColNames.includes('printed_at')) {
    db!.exec("ALTER TABLE disputes ADD COLUMN printed_at TEXT")
  }
  if (!disputeColNames.includes('sent_at')) {
    db!.exec("ALTER TABLE disputes ADD COLUMN sent_at TEXT")
  }
  if (!disputeColNames.includes('pending_at')) {
    db!.exec("ALTER TABLE disputes ADD COLUMN pending_at TEXT")
  }
  if (!disputeColNames.includes('resend_at')) {
    db!.exec("ALTER TABLE disputes ADD COLUMN resend_at TEXT")
  }
  if (!disputeColNames.includes('completed_at')) {
    db!.exec("ALTER TABLE disputes ADD COLUMN completed_at TEXT")
  }

  for (const table of ['reports', 'fico_scores']) {
    const exists = db!.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)
    if (!exists) {
      if (table === 'reports') {
        db!.exec(`
          CREATE TABLE reports (
            user_id INTEGER NOT NULL,
            bureau TEXT NOT NULL,
            data TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, bureau)
          );
        `)
      } else if (table === 'fico_scores') {
        db!.exec(`
          CREATE TABLE fico_scores (
            user_id INTEGER NOT NULL,
            bureau TEXT NOT NULL,
            score INTEGER,
            date_updated TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, bureau)
          );
        `)
      }
    }
  }
}

const BUREAU_RESPONSE_DAYS: Record<string, number> = {
  Experian: 30,
  Equifax: 30,
  TransUnion: 30,
}

export function calculateExpectedResponseDate(bureau: string, filedDate: string): string {
  const days = BUREAU_RESPONSE_DAYS[bureau] || 30
  const date = new Date(filedDate)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

export function getBureauResponseDays(bureau: string): number {
  return BUREAU_RESPONSE_DAYS[bureau] || 30
}

const LETTER_TYPE_WAITING_DAYS: Record<string, number> = {
  validation: 30,
  dispute: 30,
  revocation: 15,
}

export function getLetterTypeWaitingDays(letterType: string): number {
  return LETTER_TYPE_WAITING_DAYS[letterType] || 30
}

export function calculateExpectedResponseDateFrom(letterType: string, fromDate: string): string {
  const days = getLetterTypeWaitingDays(letterType)
  const date = new Date(fromDate)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}
