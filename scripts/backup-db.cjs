const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const dbPath = path.join(__dirname, '..', 'data', 'credit-dashboard.db')
const backupsDir = path.join(__dirname, '..', 'data', 'backups')

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true })
}

const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '')
const backupPath = path.join(backupsDir, `credit-dashboard-${stamp}.db`)

function loadPostgresEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return false
  const raw = fs.readFileSync(envPath, 'utf8')
  const m = raw.match(/POSTGRES_URL=\"([^\"]+)\"/)
  if (!m) return false
  process.env.POSTGRES_URL = m[1]
  return true
}

async function syncLettersToSqlite(db) {
  if (!loadPostgresEnv()) return
  const { sql } = require('@vercel/postgres')
  try {
    const res = await sql.query('SELECT user_id, creditor_name, bureau, letter_type, letter_text, created_at FROM dispute_letters')
    db.exec(`
      CREATE TABLE IF NOT EXISTS dispute_letters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        creditor_name TEXT NOT NULL,
        bureau TEXT NOT NULL,
        letter_type TEXT NOT NULL,
        letter_text TEXT NOT NULL,
        created_at TEXT
      )
    `)
    db.exec('DELETE FROM dispute_letters')
    const insert = db.prepare(
      'INSERT INTO dispute_letters (user_id, creditor_name, bureau, letter_type, letter_text, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const tx = db.transaction((rows) => {
      for (const row of rows) {
        const created = row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? null)
        insert.run(row.user_id, row.creditor_name, row.bureau, row.letter_type, row.letter_text, created)
      }
    })
    tx(res.rows)
    console.log(`Synced ${res.rows.length} dispute letters from Postgres`)
  } catch (e) {
    console.warn('Letter sync skipped:', e.message)
  }
}

async function main() {
  const db = new Database(dbPath)
  await syncLettersToSqlite(db)
  await db.backup(backupPath)
  db.close()

  console.log(`Backup created: ${backupPath} (${fs.statSync(backupPath).size} bytes)`)

  const backups = fs.readdirSync(backupsDir).filter((f) => f.endsWith('.db')).sort()
  if (backups.length > 30) {
    const toRemove = backups.slice(0, backups.length - 30)
    for (const f of toRemove) {
      fs.unlinkSync(path.join(backupsDir, f))
      console.log(`Pruned old backup: ${f}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
