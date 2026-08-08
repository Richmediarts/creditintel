/**
 * Sync user 1 bills to match /home/rich/NewReport/Monthly Bills.xlsx
 *
 * Strategy:
 *   1. Delete all budget_bills for user_id=1 in Postgres (migration re-runs left 6x dupes).
 *   2. Re-import the 40 clean bills from the local SQLite master (data/credit-dashboard.db).
 *   3. Apply the spreadsheet: for each row with a due date, match by normalized payee name,
 *      update amount + due date; insert rows missing from the DB.
 *   4. Rows in the spreadsheet without a due date (fuel/groceries/empty budget lines) are skipped.
 *
 * Existing DB bills not present in the spreadsheet are left untouched.
 */
const Database = require('better-sqlite3')
const { createPool } = require('@vercel/postgres')

const USER_ID = 1

// --- Load .env.local manually (no dotenv dependency) ---
const fs = require('fs')
const path = require('path')
const envFile = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/"\s*$/, '')
  }
}

// --- Spreadsheet data (from openpyxl parse of Monthly Bills.xlsx) ---
// Each entry: [spreadsheetName, dueDate 'YYYY-MM-DD' or null, amount]
const SPREADSHEET_BILLS = [
  // Home & Utilities
  ['PennyMac', '2026-09-01', 1788.38],
  ['Brookside HOA Fees (YRLY)', '2027-01-01', 33.333333333333336],
  ['TrueGreen', '2026-09-01', 61],
  ['Anthem', '2026-09-01', 39.666666666666664],
  // Transportation
  ['Bridgecrest - Sorento', '2026-09-02', 389],
  ['CapitalOne Auto', '2026-09-09', 373],
  ['Progressive', '2026-08-24', 336.51],
  // Internet / TV / Cell / Security
  ['AT&T Wireless', '2026-08-16', 616.19],
  ['Xfinity', '2026-09-30', 260.57], // spreadsheet has invalid "9/31/2026" -> clamped
  ['Vivint Security', '2026-09-05', 30],
  ['Security Equipment (Fortiva)', '2026-08-18', 70],
  // Water/Gas/Electric
  ['GreyStone Power', '2026-08-21', 123],
  ['GAS SOUTH', '2026-08-23', 80],
  ['Paulding County Water', '2026-08-24', 75],
  ['Community Waste', '2026-09-01', 20.67],
  // School Debt
  ['Nelnet - Ella', '2026-08-25', 400],
  ['Nelnet - Richard', '2027-02-09', 1008],
  // Credit Cards
  ['Ella\u2019s Discover', '2026-08-21', 50],
  ['Ella\u2019s Old Navy CC', '2026-08-20', 50],
  ['Ella\u2019s Apple Card', '2026-08-31', 50],
  ['Ella\u2019s PNC Cash Rewards', '2026-07-31', 50],
  ['Ella\u2019s Ally CC', '2026-08-22', 50],
  ['Ella\u2019s AVANT CC', '2026-08-25', 50],
  ['Ella\u2019s Mission Lane CC', '2026-08-20', 50],
  ['Ella\u2019s Indigo CC', '2026-08-15', 50],
  ['Ella\u2019s Destiny CC', '2026-08-15', 50],
  ['Ella\u2019s Prosper', '2026-09-08', 50],
  ['Rich Amazon Card', '2026-08-13', 40],
  ['Rich\u2019s Apple Card', '2026-09-01', 50],
  ['Mission Lane', '2026-09-09', 40],
  ['Rich\u2019s Quicksilver Cap1-9223', '2026-09-01', 35],
  ['Rich\u2019s Cap1 Venture-6873', '2026-08-19', 30],
  ['Rich\u2019s Secure Cap1-5491', '2026-09-09', 30],
  ['Rich\u2019s Plat2  Cap1-5566', '2026-09-01', 30],
  ['Rich\u2019s Cap1 Savor', '2026-08-18', 25],
  ['Rich PayPal Credit', '2026-09-04', 61],
  ['Credit One AMEX', '2026-08-31', 35],
  ['Rich\u2019s Indigo', '2026-09-13', 40],
  // Other Expenses
  ['Midland - (APH Law)', '2026-09-01', 50],
  ['Klarna K&G (My Suit)', '2026-09-07', 24.25],
  ['Klarna - Sam\u2019s Club (Ethans monitor)', '2026-08-13', 20.09],
  ['Klarna - Walmart', '2026-08-14', 36.84],
  ['Klarna - StubHub', '2026-08-14', 16.65],
]

// Existing DB payee names that are actually the same bill as a spreadsheet name.
const NAME_ALIASES = {
  'capitalone auto': 'capitalone auto loan',
  'pay pal credit': 'rich paypal credit',
}

function normalize(name) {
  if (!name) return ''
  return String(name)
    .replace(/[\u2018\u2019\u201A\u00B4]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function toDateStr(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().split('T')[0]
  const s = String(v).trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

async function main() {
  // --- Step 1 & 2: re-import clean bills from SQLite ---
  const sqlite = new Database(path.join(__dirname, '..', 'data', 'credit-dashboard.db'))
  const cleanBills = sqlite
    .prepare('SELECT * FROM budget_bills WHERE user_id = ? ORDER BY id')
    .all(USER_ID)
  console.log(`SQLite master bills: ${cleanBills.length}`)

  const pool = createPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM budget_bills WHERE user_id = $1', [USER_ID])
    for (const b of cleanBills) {
      await client.query(
        `INSERT INTO budget_bills
          (user_id, payee_id, payee_name, amount, due_date, is_paid, paid_date,
           is_recurring, recurrence_type, notes, category_id, account, credit_card_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [USER_ID, b.payee_id, b.payee_name, round2(b.amount), toDateStr(b.due_date),
         b.is_paid, toDateStr(b.paid_date), b.is_recurring, b.recurrence_type,
         b.notes, b.category_id, b.account, b.credit_card_id]
      )
    }

    // --- Step 3: spreadsheet sync ---
    const existing = await client.query('SELECT id, payee_name FROM budget_bills WHERE user_id = $1', [USER_ID])
    // Normalized name -> bill id (prefer the $40 Mission Lane over the $1249.41 credit-card-payment bill)
    const byName = new Map()
    for (const row of existing.rows) {
      const key = NAME_ALIASES[normalize(row.payee_name)] || normalize(row.payee_name)
      const prev = byName.get(key)
      if (!prev || row.id < prev.id) byName.set(key, row.id)
    }

    let updated = 0
    let inserted = 0
    let skipped = 0
    for (const [ssName, due, amount] of SPREADSHEET_BILLS) {
      if (!due) {
        skipped++
        continue
      }
      const key = normalize(ssName)
      const targetKey = NAME_ALIASES[key] || key
      const id = byName.get(targetKey)
      if (id) {
        await client.query(
          'UPDATE budget_bills SET amount = $1, due_date = $2 WHERE id = $3 AND user_id = $4',
          [round2(amount), due, id, USER_ID]
        )
        updated++
      } else {
        await client.query(
          `INSERT INTO budget_bills
            (user_id, payee_name, amount, due_date, is_paid, is_recurring, recurrence_type)
           VALUES ($1,$2,$3,$4,0,1,'monthly')`,
          [USER_ID, ssName.replace(/[\u2018\u2019]/g, "'"), round2(amount), due]
        )
        inserted++
      }
    }

    await client.query('COMMIT')

    const final = await client.query('SELECT id, payee_name, amount, due_date, is_paid FROM budget_bills WHERE user_id = $1 ORDER BY due_date', [USER_ID])
    console.log(`Postgres bills after sync: ${final.rowCount}`)
    console.log(`Spreadsheet rows updated: ${updated}, inserted: ${inserted}, skipped (no due date): ${skipped}`)
    console.log('\n--- FINAL BILL LIST (user 1) ---')
    for (const r of final.rows) {
      console.log(`${r.id} | ${r.payee_name} | ${r.amount} | ${r.due_date} | paid=${r.is_paid}`)
    }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
    await pool.end()
    sqlite.close()
  }
}

main().catch((e) => {
  console.error('SYNC FAILED:', e.message)
  process.exit(1)
})
