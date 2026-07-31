// Migrates data from the legacy Flask budget app (budget.db) into credit-dashboard.db
// Assigns all data to a target user (default: user_id 1 = admin).
//
// Usage:
//   node scripts/migrate-budget.cjs [source-db] [target-user-id]
//   node scripts/migrate-budget.cjs /home/rich/DATA/budget_app/budget.db 1

const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const SOURCE_DB = process.argv[2] || '/home/rich/DATA/budget_app/budget.db'
const TARGET_USER_ID = Number(process.argv[3] || 1)

const targetDbPath = path.join(__dirname, '..', 'data', 'credit-dashboard.db')

if (!fs.existsSync(SOURCE_DB)) {
  console.error(`Source DB not found: ${SOURCE_DB}`)
  process.exit(1)
}

const src = new Database(SOURCE_DB, { readonly: true })
const dst = new Database(targetDbPath)

// Ensure budget tables exist in the target DB using the same schema as src/lib/budget-db.ts
function ensureTargetSchema() {
  dst.exec(`
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
      deposit2_amount REAL DEFAULT 0, notes TEXT
    );
    CREATE TABLE IF NOT EXISTS budget_bank_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL, account_type TEXT NOT NULL, institution TEXT,
      account_number_last4 TEXT, current_balance REAL DEFAULT 0, website TEXT,
      is_active INTEGER DEFAULT 1, is_income_account INTEGER DEFAULT 0, interest_rate REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS budget_credit_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL, last_four TEXT, credit_limit REAL DEFAULT 0,
      current_balance REAL DEFAULT 0, interest_rate REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1, website TEXT, due_date TEXT
    );
    CREATE TABLE IF NOT EXISTS budget_payees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL, category TEXT, account_number TEXT, notes TEXT,
      website TEXT, default_category_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS budget_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      payee_id INTEGER, payee_name TEXT, amount REAL DEFAULT 0,
      due_date TEXT NOT NULL, is_paid INTEGER DEFAULT 0, paid_date TEXT,
      is_recurring INTEGER DEFAULT 0, recurrence_type TEXT, notes TEXT,
      category_id INTEGER, account TEXT, credit_card_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS budget_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL, monthly_limit REAL DEFAULT 0,
      color TEXT DEFAULT '#2E7D32', parent_id INTEGER DEFAULT NULL
    );
  `)
}

// Column lists per table (excluding id). Used to build INSERT ... ON CONFLICT.
const TABLES = {
  budget_paychecks: [
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
  ],
  budget_bank_accounts: ['name', 'account_type', 'institution', 'account_number_last4', 'current_balance', 'website', 'is_active', 'is_income_account', 'interest_rate'],
  budget_credit_cards: ['name', 'last_four', 'credit_limit', 'current_balance', 'interest_rate', 'is_active', 'website', 'due_date'],
  budget_payees: ['name', 'category', 'account_number', 'notes', 'website', 'default_category_id'],
  budget_bills: ['payee_id', 'payee_name', 'amount', 'due_date', 'is_paid', 'paid_date', 'is_recurring', 'recurrence_type', 'notes', 'category_id', 'account', 'credit_card_id'],
  budget_categories: ['name', 'monthly_limit', 'color', 'parent_id'],
}

// Map source table name -> target budget table name
const SOURCE_TO_TARGET = {
  paychecks: 'budget_paychecks',
  bank_accounts: 'budget_bank_accounts',
  credit_cards: 'budget_credit_cards',
  payees: 'budget_payees',
  bills: 'budget_bills',
  budget_categories: 'budget_categories',
}

function migrateTable(srcTable, dstTable) {
  const columns = TABLES[dstTable]
  if (!columns) return
  const srcExists = src.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(srcTable)
  if (!srcExists) {
    console.log(`  - ${srcTable}: table not present, skipped`)
    return
  }
  const rows = src.prepare(`SELECT * FROM ${srcTable}`).all()
  const dstCount = dst.prepare(`SELECT COUNT(*) as c FROM ${dstTable}`).get().c
  if (dstCount > 0) {
    console.log(`  - ${srcTable} -> ${dstTable}: target already has ${dstCount} rows, skipping (use --force after clearing)`)
    return
  }

  const colList = ['user_id', ...columns]
  const placeholders = colList.map(() => '?').join(', ')
  const insert = dst.prepare(
    `INSERT INTO ${dstTable} (${colList.join(', ')}) VALUES (${placeholders})`
  )

  const tx = dst.transaction(() => {
    for (const row of rows) {
      const values = colList.map((col) => {
        if (col === 'user_id') return TARGET_USER_ID
        return row[col] !== undefined ? row[col] : null
      })
      insert.run(...values)
    }
  })
  tx()
  console.log(`  - ${srcTable} -> ${dstTable}: migrated ${rows.length} rows`)
}

function main() {
  ensureTargetSchema()
  console.log(`Migrating ${SOURCE_DB} -> ${targetDbPath} (user_id=${TARGET_USER_ID})`)
  for (const [srcTable, dstTable] of Object.entries(SOURCE_TO_TARGET)) {
    migrateTable(srcTable, dstTable)
  }
  console.log('Done.')
  src.close()
  dst.close()
}

main()
