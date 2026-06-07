import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'credit-dashboard.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
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
