import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const env = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
for (const l of env.split('\n')) {
  if (l.startsWith('POSTGRES_URL=')) {
    process.env.POSTGRES_URL = l.slice('POSTGRES_URL='.length).replace(/["']/g, '').trim()
  }
}
const { sql } = require('@vercel/postgres')

const OUT_DIR = path.join(process.cwd(), 'data', 'exports')

const TABLES = [
  ['budget_bank_accounts', 'Bank_Accounts'],
  ['budget_bills', 'Bills'],
  ['budget_credit_cards', 'Credit_Cards'],
  ['budget_payees', 'Payees'],
  ['budget_categories', 'Categories'],
]

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

async function main() {
  const USER_ID = process.env.EXPORT_USER_ID ? Number(process.env.EXPORT_USER_ID) : 1
  fs.mkdirSync(OUT_DIR, { recursive: true })

  for (const [table, label] of TABLES) {
    const colsRes = await sql.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [table],
    )
    const cols = colsRes.rows.map((r) => r.column_name)
    const rows = await sql.query(
      `SELECT * FROM ${table} WHERE user_id = $1 ORDER BY id`,
      [USER_ID],
    )

    const lines = [cols.join(',')]
    for (const row of rows.rows) {
      lines.push(cols.map((c) => csvEscape(row[c])).join(','))
    }

    const file = path.join(OUT_DIR, `${label}.csv`)
    fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8')
    console.log(`Wrote ${file} (${rows.rows.length} rows)`)
  }
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
