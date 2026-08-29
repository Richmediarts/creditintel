import { sql } from '@vercel/postgres'

export async function initPostgresSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      address TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      reset_token TEXT,
      reset_token_expiry TIMESTAMP,
      is_example INTEGER NOT NULL DEFAULT 0,
      mirror_user_id INTEGER
    );
  `
  await sql`
    CREATE TABLE IF NOT EXISTS disputes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      creditor_name TEXT NOT NULL,
      bureau TEXT NOT NULL,
      inaccuracies TEXT,
      status TEXT NOT NULL DEFAULT 'not_filed',
      filed_date DATE,
      expected_response_date DATE,
      resolved_date DATE,
      notes TEXT,
      letter_type TEXT NOT NULL DEFAULT 'validation',
      printed_at TIMESTAMP,
      sent_at TIMESTAMP,
      pending_at TIMESTAMP,
      resend_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `
  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      user_id INTEGER NOT NULL REFERENCES users(id),
      bureau TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, bureau)
    );
  `
  await sql`
    CREATE TABLE IF NOT EXISTS dispute_letters (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      creditor_name TEXT NOT NULL,
      bureau TEXT NOT NULL,
      letter_type TEXT NOT NULL,
      letter_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `
  await sql`
    CREATE TABLE IF NOT EXISTS fico_scores (
      user_id INTEGER NOT NULL REFERENCES users(id),
      bureau TEXT NOT NULL,
      score INTEGER,
      date_updated TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, bureau)
    );
  `
  await sql`
    CREATE TABLE IF NOT EXISTS budget_paychecks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      pay_date DATE, pay_period_begin DATE, pay_period_end DATE,
      check_date DATE, check_number TEXT, employee_name TEXT, employee_id TEXT,
      company TEXT, hours_worked REAL DEFAULT 0, gross_pay REAL DEFAULT 0,
      pre_tax_deductions REAL DEFAULT 0, employee_taxes REAL DEFAULT 0,
      post_tax_deductions REAL DEFAULT 0, net_pay REAL DEFAULT 0,
      salary REAL DEFAULT 0, salary_hours REAL DEFAULT 0, salary_rate REAL DEFAULT 0,
      biometric_credit REAL DEFAULT 0, biometric_credit_hours REAL DEFAULT 0, biometric_credit_rate REAL DEFAULT 0,
      floating_holiday REAL DEFAULT 0, floating_holiday_hours REAL DEFAULT 0, floating_holiday_rate REAL DEFAULT 0,
      holiday_pay REAL DEFAULT 0, holiday_pay_hours REAL DEFAULT 0, holiday_pay_rate REAL DEFAULT 0,
      vacation_pay REAL DEFAULT 0, vacation_hours REAL DEFAULT 0, vacation_rate REAL DEFAULT 0,
      group_term_life REAL DEFAULT 0, group_term_life_hours REAL DEFAULT 0, group_term_life_rate REAL DEFAULT 0,
      spousal_biometric REAL DEFAULT 0, spousal_biometric_hours REAL DEFAULT 0, spousal_biometric_rate REAL DEFAULT 0,
      other_earnings REAL DEFAULT 0, other_earnings_hours REAL DEFAULT 0, other_earnings_rate REAL DEFAULT 0,
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
      deposit2_amount REAL DEFAULT 0, notes TEXT, raw_text TEXT,
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
      vacation_pay_ytd REAL DEFAULT 0, salary_ytd REAL DEFAULT 0
    );
  `
  await sql`
    CREATE TABLE IF NOT EXISTS budget_bank_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
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
      last_synced_at TIMESTAMP
    );
  `
  await sql`
    CREATE TABLE IF NOT EXISTS budget_credit_cards (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      last_four TEXT,
      institution TEXT,
      credit_limit REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      interest_rate REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      website TEXT,
      due_date TEXT,
      plaid_account_id TEXT,
      plaid_item_id INTEGER,
      last_synced_at TIMESTAMP
    );
  `
  await sql`
    CREATE TABLE IF NOT EXISTS budget_payees (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      category TEXT,
      account_number TEXT,
      notes TEXT,
      website TEXT,
      default_category_id INTEGER
    );
  `
  await sql`
    CREATE TABLE IF NOT EXISTS budget_bills (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      payee_id INTEGER,
      payee_name TEXT,
      amount REAL DEFAULT 0,
      due_date DATE NOT NULL,
      is_paid INTEGER DEFAULT 0,
      paid_date DATE,
      is_recurring INTEGER DEFAULT 0,
      recurrence_type TEXT,
      notes TEXT,
      category_id INTEGER,
      account TEXT,
      credit_card_id INTEGER,
      url TEXT
    );
  `
  await sql`
    CREATE TABLE IF NOT EXISTS budget_categories (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      monthly_limit REAL DEFAULT 0,
      color TEXT DEFAULT '#6366f1',
      parent_id INTEGER,
      actual_spent REAL DEFAULT 0
    );
  `
  await sql`
    CREATE TABLE IF NOT EXISTS budget_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      account_id INTEGER NOT NULL REFERENCES budget_bank_accounts(id),
      date DATE NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      balance REAL DEFAULT 0,
      plaid_transaction_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `
  await sql`
    CREATE TABLE IF NOT EXISTS budget_plaid_items (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      access_token TEXT NOT NULL,
      item_id TEXT,
      institution_name TEXT,
      plaid_cursor TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `
  await sql`
    CREATE TABLE IF NOT EXISTS budget_modified_income (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL DEFAULT 0,
      entry_date DATE,
      period_type TEXT DEFAULT 'biweekly',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `

  await sql`
    ALTER TABLE budget_credit_cards ADD COLUMN IF NOT EXISTS institution TEXT;
  `

  await sql`
    ALTER TABLE budget_bills ADD COLUMN IF NOT EXISTS url TEXT;
  `

  await sql`
    ALTER TABLE budget_bank_accounts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;
  `
  await sql`
    ALTER TABLE budget_credit_cards ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;
  `

  // budget_transactions.account_id stores both bank-account and credit-card ids
  // (credit-card accounts are linked via Plaid), so the bank-only FK is relaxed.
  await sql`
    ALTER TABLE budget_transactions DROP CONSTRAINT IF EXISTS budget_transactions_account_id_fkey;
  `

  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS salary_hours REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS salary_rate REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS vacation_hours REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS vacation_rate REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS holiday_pay_hours REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS holiday_pay_rate REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS floating_holiday_hours REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS floating_holiday_rate REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS biometric_credit_hours REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS biometric_credit_rate REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS spousal_biometric_hours REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS spousal_biometric_rate REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS group_term_life_hours REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS group_term_life_rate REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS other_earnings_hours REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS other_earnings_rate REAL DEFAULT 0;
  `
  await sql`
    ALTER TABLE budget_paychecks ADD COLUMN IF NOT EXISTS raw_text TEXT;
  `

  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_example INTEGER NOT NULL DEFAULT 0;
  `
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mirror_user_id INTEGER;
  `

  const serialTables = [
    'users',
    'disputes',
    'dispute_letters',
    'budget_paychecks',
    'budget_bank_accounts',
    'budget_credit_cards',
    'budget_payees',
    'budget_bills',
    'budget_categories',
    'budget_transactions',
    'budget_plaid_items',
    'budget_modified_income',
  ]

  for (const table of serialTables) {
    try {
      await sql.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE(MAX(id), 1)) FROM ${table}`,
        [table]
      )
    } catch (e) {
      console.warn(`Sequence fixup skipped for ${table}:`, e)
    }
  }

  console.log('Postgres schema initialized')
}