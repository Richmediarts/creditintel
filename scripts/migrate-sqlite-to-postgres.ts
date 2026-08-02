#!/usr/bin/env node
// Migration script: SQLite -> Vercel Postgres
// Run locally with: npx tsx scripts/migrate-sqlite-to-postgres.ts
// Requires: npm install @vercel/postgres better-sqlite3

import Database from 'better-sqlite3'
import { sql } from '@vercel/postgres'
import { createPool } from '@vercel/postgres'
import path from 'path'

const sqlitePath = path.join(process.cwd(), 'data', 'credit-dashboard.db')
const sqlite = new Database(sqlitePath)

// Use the underlying pool for dynamic queries
const pool = createPool()

async function migrate() {
  console.log('Starting SQLite -> Postgres migration...')

  // 1. Users
  const users = sqlite.prepare('SELECT * FROM users').all()
  for (const u of users) {
    await sql`
      INSERT INTO users (id, name, email, password_hash, role, address, created_at)
      VALUES (${u.id}, ${u.name}, ${u.email}, ${u.password_hash}, ${u.role}, ${u.address || ''}, ${u.created_at})
      ON CONFLICT (id) DO NOTHING
    `
  }
  console.log(`Migrated ${users.length} users`)

  // 2. Disputes
  const disputes = sqlite.prepare('SELECT * FROM disputes').all()
  for (const d of disputes) {
    await sql`
      INSERT INTO disputes (id, user_id, creditor_name, bureau, inaccuracies, status, filed_date, expected_response_date, resolved_date, notes, created_at, updated_at)
      VALUES (${d.id}, ${d.user_id}, ${d.creditor_name}, ${d.bureau}, ${d.inaccuracies}, ${d.status}, ${d.filed_date}, ${d.expected_response_date}, ${d.resolved_date}, ${d.notes}, ${d.created_at}, ${d.updated_at})
      ON CONFLICT (id) DO NOTHING
    `
  }
  console.log(`Migrated ${disputes.length} disputes`)

  // 3. Reports
  const reports = sqlite.prepare('SELECT * FROM reports').all()
  for (const r of reports) {
    await sql`
      INSERT INTO reports (user_id, bureau, data, updated_at)
      VALUES (${r.user_id}, ${r.bureau}, ${r.data}, ${r.updated_at})
      ON CONFLICT (user_id, bureau) DO NOTHING
    `
  }
  console.log(`Migrated ${reports.length} reports`)

  // 4. FICO Scores
  const fico = sqlite.prepare('SELECT * FROM fico_scores').all()
  for (const f of fico) {
    await sql`
      INSERT INTO fico_scores (user_id, bureau, score, date_updated)
      VALUES (${f.user_id}, ${f.bureau}, ${f.score}, ${f.date_updated})
      ON CONFLICT (user_id, bureau) DO NOTHING
    `
  }
  console.log(`Migrated ${fico.length} FICO scores`)

  // 5. Budget tables
  const budgetTables = [
    'budget_paychecks', 'budget_bank_accounts', 'budget_credit_cards',
    'budget_payees', 'budget_bills', 'budget_categories',
    'budget_transactions', 'budget_plaid_items', 'budget_modified_income'
  ]

for (const table of budgetTables) {
    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all()
    if (rows.length === 0) continue

    const cols = Object.keys(rows[0]).filter(k => k !== 'id')
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
    const colNames = cols.join(', ')

    // Date columns that need empty string -> null conversion
    const dateCols = new Set(['pay_date', 'pay_period_begin', 'pay_period_end', 'check_date', 'due_date', 'paid_date', 'entry_date', 'created_at', 'updated_at', 'date', 'filed_date', 'expected_response_date', 'resolved_date', 'printed_at', 'sent_at', 'pending_at', 'resend_at', 'completed_at', 'plaid_cursor'])

    for (const row of rows) {
      const values = cols.map(c => {
        const v = row[c] ?? null
        // Convert empty strings to null for date columns
        if (dateCols.has(c) && v === '') return null
        return v
      })
      // Skip rows with null required date columns
      if (table === 'budget_transactions' && values[cols.indexOf('date')] === null) {
        console.log(`  Skipping transaction with null date: id=${row.id}`)
        continue
      }
      await pool.query(`INSERT INTO ${table} (${colNames}) VALUES (${placeholders})`, values)
    }
    console.log(`Migrated ${rows.length} rows to ${table}`)
  }

  // 6. Settings
  const settings = sqlite.prepare('SELECT * FROM settings').all()
  for (const s of settings) {
    await sql`
      INSERT INTO settings (key, value) VALUES (${s.key}, ${s.value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `
  }
  console.log(`Migrated ${settings.length} settings`)

  // 7. Reset sequences
  for (const table of budgetTables) {
    const maxId = sqlite.prepare(`SELECT MAX(id) as max FROM ${table}`).get()
    if (maxId?.max) {
      await pool.query(`SELECT setval('${table}_id_seq', ${maxId.max})`)
    }
  }
  await pool.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`)
  await pool.query(`SELECT setval('disputes_id_seq', (SELECT MAX(id) FROM disputes))`)

  console.log('Migration complete!')
  await pool.end()
  process.exit(0)
}

migrate().catch(async err => {
  console.error('Migration failed:', err)
  await pool.end()
  process.exit(1)
})