import { sql } from '@vercel/postgres'

let schemaInit: Promise<void> | null = null

export function ensureSchema(): Promise<void> {
  if (!schemaInit) {
    schemaInit = initSchema()
  }
  return schemaInit
}

export async function initSchema() {
  const { initPostgresSchema } = await import('./db-postgres')
  await initPostgresSchema()
}

export async function seedFromFile() {
  // No-op: data lives in Postgres, not seeded from file
}

function convertPlaceholders(query: string): string {
  let out = ''
  let i = 0
  let n = 0
  let inQuote: string | null = null
  while (i < query.length) {
    const ch = query[i]
    if (inQuote) {
      out += ch
      if (ch === inQuote) {
        inQuote = null
      }
    } else if (ch === "'" || ch === '"') {
      inQuote = ch
      out += ch
    } else if (ch === '?') {
      n++
      out += '$' + n
    } else {
      out += ch
    }
    i++
  }
  return out
}

async function run(sqlText: string, params: unknown[]) {
  await ensureSchema()
  return sql.query(convertPlaceholders(sqlText), params as never[])
}

export const db = {
  async query(query: string, params: unknown[]) {
    return run(query, params)
  },

  async get(sqlText: string, params: unknown[]) {
    const result = await run(sqlText, params)
    return result.rows[0] || null
  },

  async all(sqlText: string, params: unknown[]) {
    const result = await run(sqlText, params)
    return result.rows
  },

  async run(sqlText: string, params: unknown[]) {
    const result = await run(sqlText, params)
    return { changes: result.rowCount ?? 0, lastInsertRowid: result.rows[0]?.id }
  },

  async exec(sqlText: string) {
    await run(sqlText, [])
  },

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const client = await sql.connect()
    try {
      await client.query('BEGIN')
      const result = await fn()
      await client.query('COMMIT')
      return result
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  },

  prepare(sqlText: string) {
    return {
      run: async (...params: unknown[]) => {
        return db.run(sqlText, params)
      },
      get: async (...params: unknown[]) => {
        return db.get(sqlText, params)
      },
      all: async (...params: unknown[]) => {
        return db.all(sqlText, params)
      },
    }
  },
}

export function getDb() {
  return db
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
  inquiry: 30,
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
