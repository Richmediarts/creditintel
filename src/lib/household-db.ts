/**
 * Shared-household data layer for the biweekly pay-period planner.
 *
 * Model: every budget row is owned by a single `user_id` (the household
 * budget owner, admin). A spouse joins via `budget_households` + the
 * `users.household_id` column, and the planner reads the OWNER's data for
 * every member. Members keep their own privacy level
 * (`budget_share_level`) and can contribute bill details or a simple
 * monthly contribution without linking any accounts.
 */

import { getDb } from '@/lib/db'

export type SpouseKey = 'me' | 'wife' | 'shared'
export type DetailStatus = 'confirmed' | 'estimated' | 'missing'
export type ShareLevel = 'details' | 'totals' | 'none'

export interface Household {
  id: number
  created_by: number
  name: string
  unconfirmed_reserve: number
  cushion_target: number
  split_mode: string
}

export interface HouseholdMember {
  user_id: number
  name: string
  email: string
  role: string
  share_level: ShareLevel
  is_owner: boolean
}

export interface IncomeSchedule {
  id: number
  user_id: number
  name: string
  spouse: SpouseKey
  pay_start_date: string
  frequency: string
  net_amount: number
  is_active: number
  notes: string
}

export interface Reserve {
  id: number
  user_id: number
  name: string
  target_amount: number
  target_date: string
  amount_saved: number
  per_period: number
  status: DetailStatus
  bill_id?: number | null
  notes: string
}

export interface CreditTask {
  id: number
  user_id: number
  title: string
  type: string
  status: string
  target_date: string
  bureau: string
  notes: string
}

export interface MemberContribution {
  id: number
  user_id: number
  amount: number
  notes: string
  created_at: string
}

function toDateString(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined
  if (v instanceof Date) return v.toISOString().split('T')[0]
  const s = String(v)
  const m = s.match(/^\d{4}-\d{2}-\d{2}/)
  return m ? m[0] : s
}

// ---------------------------------------------------------------------------
// Household
// ---------------------------------------------------------------------------

/** The household I belong to, creating one automatically if needed. */
export async function getOrCreateHousehold(userId: number): Promise<Household> {
  const db = getDb()
  // Joining another household wins: never clobber a member's household link
  // by creating a fresh one.
  const me = (await db.prepare(
    'SELECT household_id FROM users WHERE id = ?'
  ).get(userId)) as { household_id: number | null } | undefined
  if (me?.household_id) {
    const joined = await getHouseholdById(me.household_id)
    if (joined) return joined
  }
  const existingByUser = (await db.prepare(
    'SELECT id FROM budget_households WHERE created_by = ?'
  ).get(userId)) as { id: number } | undefined
  if (existingByUser) {
    await db.prepare('UPDATE users SET household_id = ? WHERE id = ? AND household_id IS NULL').run(existingByUser.id, userId)
    const householdByUrl = await getHouseholdById(existingByUser.id)
    if (householdByUrl) return householdByUrl
  }
  const result = await db.prepare(
    'INSERT INTO budget_households (created_by, name) VALUES (?, ?) RETURNING id'
  ).run(userId, 'Our Household')
  const householdId = Number(result.lastInsertRowid)
  await db.prepare('UPDATE users SET household_id = ? WHERE id = ?').run(householdId, userId)
  const fresh = await getHouseholdById(householdId)
  if (!fresh) throw new Error('Failed to create household')
  return fresh
}

export async function getHouseholdById(householdId: number): Promise<Household | null> {
  const db = getDb()
  const row = (await db.prepare(
    'SELECT id, created_by, name, unconfirmed_reserve, cushion_target, split_mode FROM budget_households WHERE id = ?'
  ).get(householdId)) as Household | undefined
  return row ?? null
}

/**
 * The user whose data powers my household view. Joining a household
 * redirects every budget read/write to the household owner's rows.
 */
export async function resolveBudgetUserId(authUserId: number): Promise<number> {
  const db = getDb()
  const me = (await db.prepare(
    'SELECT household_id FROM users WHERE id = ?'
  ).get(authUserId)) as { household_id: number | null } | undefined
  if (!me?.household_id) return authUserId
  const household = (await db.prepare(
    'SELECT created_by FROM budget_households WHERE id = ?'
  ).get(me.household_id)) as { created_by: number } | undefined
  return household?.created_by ?? authUserId
}

export async function updateHousehold(userId: number, data: {
  name?: string
  unconfirmed_reserve?: number
  cushion_target?: number
  split_mode?: string
}): Promise<void> {
  const db = getDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
  if (data.unconfirmed_reserve !== undefined) { sets.push('unconfirmed_reserve = ?'); values.push(Math.max(0, Number(data.unconfirmed_reserve) || 0)) }
  if (data.cushion_target !== undefined) { sets.push('cushion_target = ?'); values.push(Math.max(0, Number(data.cushion_target) || 0)) }
  if (data.split_mode !== undefined) { sets.push('split_mode = ?'); values.push(data.split_mode) }
  if (sets.length === 0) return
  values.push(userId)
  await db.prepare(`UPDATE budget_households SET ${sets.join(', ')} WHERE created_by = ?`).run(...values)
}

export async function getHouseholdMembers(householdId: number): Promise<HouseholdMember[]> {
  const db = getDb()
  const household = await getHouseholdById(householdId)
  if (!household) return []
  const rows = (await db.prepare(
    `SELECT id, name, email, role, budget_share_level FROM users WHERE household_id = ? OR id = ?`
  ).all(householdId, household.created_by)) as Array<{
    id: number
    name: string
    email: string
    role: string
    budget_share_level: string | null
  }>
  return rows.map((r) => ({
    user_id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    share_level: (r.budget_share_level as ShareLevel) || 'totals',
    is_owner: r.id === household.created_by,
  }))
}

// ---------------------------------------------------------------------------
// Member privacy + contributions
// ---------------------------------------------------------------------------

export async function setShareLevel(userId: number, level: ShareLevel): Promise<void> {
  const db = getDb()
  await db.prepare('UPDATE users SET budget_share_level = ? WHERE id = ?').run(level, userId)
}

export async function getShareLevel(userId: number): Promise<ShareLevel> {
  const db = getDb()
  const row = (await db.prepare('SELECT budget_share_level FROM users WHERE id = ?').get(userId)) as
    | { budget_share_level: string | null }
    | undefined
  return ((row?.budget_share_level as ShareLevel) || 'totals') // ids/totals only by default
}

/**
 * A member's piped-in contribution toward the household: either a plain
 * dollar amount (created_at entry) or a link to bills they added themselves
 * (bill rows with owner = 'wife'), which never reveal other details.
 */
export async function addMemberContribution(userId: number, amount: number, notes: string): Promise<number> {
  const db = getDb()
  const result = await db.prepare(
    'INSERT INTO budget_member_contributions (user_id, amount, notes) VALUES (?, ?, ?) RETURNING id'
  ).run(userId, Math.max(0, Number(amount) || 0), notes || '')
  return Number(result.lastInsertRowid)
}

export async function getMemberContributions(userId: number): Promise<MemberContribution[]> {
  const db = getDb()
  return (await db.prepare(
    'SELECT id, user_id, amount, notes, created_at FROM budget_member_contributions WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId)) as MemberContribution[]
}

// ---------------------------------------------------------------------------
// Income schedules (expected income, per spouse)
// ---------------------------------------------------------------------------

export async function getIncomeSchedules(userId: number, onlyActive = true): Promise<IncomeSchedule[]> {
  const db = getDb()
  const rows = (await db.prepare(
    `SELECT id, user_id, name, spouse, pay_start_date, frequency, net_amount, is_active, notes
     FROM budget_income_schedules WHERE user_id = ? ${onlyActive ? 'AND is_active = 1' : ''} ORDER BY spouse, id`
  ).all(userId)) as IncomeSchedule[]
  return rows.map((r) => ({ ...r, pay_start_date: toDateString(r.pay_start_date) || r.pay_start_date as unknown as string }))
}

export async function addIncomeSchedule(userId: number, data: Partial<IncomeSchedule>): Promise<number> {
  const db = getDb()
  const result = await db.prepare(
    `INSERT INTO budget_income_schedules (user_id, name, spouse, pay_start_date, frequency, net_amount, is_active, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).run(
    userId,
    data.name || 'Paycheck',
    data.spouse || 'me',
    data.pay_start_date || null,
    data.frequency || 'biweekly',
    Math.max(0, Number(data.net_amount) || 0),
    data.is_active ?? 1,
    data.notes || ''
  )
  return Number(result.lastInsertRowid)
}

export async function updateIncomeSchedule(userId: number, id: number, data: Partial<IncomeSchedule>): Promise<void> {
  const db = getDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
  if (data.spouse !== undefined) { sets.push('spouse = ?'); values.push(data.spouse) }
  if (data.pay_start_date !== undefined) { sets.push('pay_start_date = ?'); values.push(data.pay_start_date || null) }
  if (data.frequency !== undefined) { sets.push('frequency = ?'); values.push(data.frequency) }
  if (data.net_amount !== undefined) { sets.push('net_amount = ?'); values.push(Math.max(0, Number(data.net_amount) || 0)) }
  if (data.is_active !== undefined) { sets.push('is_active = ?'); values.push(data.is_active ?? 1) }
  if (data.notes !== undefined) { sets.push('notes = ?'); values.push(data.notes || '') }
  if (sets.length === 0) return
  values.push(userId, id)
  await db.prepare(`UPDATE budget_income_schedules SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`).run(...values)
}

export async function deleteIncomeSchedule(userId: number, id: number): Promise<void> {
  const db = getDb()
  await db.prepare('DELETE FROM budget_income_schedules WHERE user_id = ? AND id = ?').run(userId, id)
}

// ---------------------------------------------------------------------------
// Reserves (partial saving toward bigger future bills)
// ---------------------------------------------------------------------------

export async function getReserves(userId: number): Promise<Reserve[]> {
  const db = getDb()
  const rows = (await db.prepare(
    `SELECT id, user_id, name, target_amount, target_date, amount_saved, per_period, status, bill_id, notes
     FROM budget_reserves WHERE user_id = ? ORDER BY id`
  ).all(userId)) as Reserve[]
  return rows.map((r) => ({ ...r, target_date: toDateString(r.target_date) || r.target_date as unknown as string }))
}

export async function addReserve(userId: number, data: Partial<Reserve>): Promise<number> {
  const db = getDb()
  const result = await db.prepare(
    `INSERT INTO budget_reserves (user_id, name, target_amount, target_date, amount_saved, per_period, status, bill_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).run(
    userId,
    data.name || 'Future bill',
    Math.max(0, Number(data.target_amount) || 0),
    data.target_date || null,
    Math.max(0, Number(data.amount_saved) || 0),
    Math.max(0, Number(data.per_period) || 0),
    data.status || 'estimated',
    data.bill_id || null,
    data.notes || ''
  )
  return Number(result.lastInsertRowid)
}

export async function updateReserve(userId: number, id: number, data: Partial<Reserve>): Promise<void> {
  const db = getDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
  if (data.target_amount !== undefined) { sets.push('target_amount = ?'); values.push(Math.max(0, Number(data.target_amount) || 0)) }
  if (data.target_date !== undefined) { sets.push('target_date = ?'); values.push(data.target_date || null) }
  if (data.amount_saved !== undefined) { sets.push('amount_saved = ?'); values.push(Math.max(0, Number(data.amount_saved) || 0)) }
  if (data.per_period !== undefined) { sets.push('per_period = ?'); values.push(Math.max(0, Number(data.per_period) || 0)) }
  if (data.status !== undefined) { sets.push('status = ?'); values.push(data.status) }
  if (data.bill_id !== undefined) { sets.push('bill_id = ?'); values.push(data.bill_id || null) }
  if (data.notes !== undefined) { sets.push('notes = ?'); values.push(data.notes || '') }
  if (sets.length === 0) return
  values.push(userId, id)
  await db.prepare(`UPDATE budget_reserves SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`).run(...values)
}

export async function deleteReserve(userId: number, id: number): Promise<void> {
  const db = getDb()
  await db.prepare('DELETE FROM budget_reserves WHERE user_id = ? AND id = ?').run(userId, id)
}

// ---------------------------------------------------------------------------
// Credit improvement tasks
// ---------------------------------------------------------------------------

export async function getCreditTasks(userId: number): Promise<CreditTask[]> {
  const db = getDb()
  const rows = (await db.prepare(
    `SELECT id, user_id, title, type, status, target_date, bureau, notes
     FROM budget_credit_tasks WHERE user_id = ? ORDER BY status, target_date NULLS LAST, id`
  ).all(userId)) as CreditTask[]
  return rows.map((r) => ({ ...r, target_date: toDateString(r.target_date) || r.target_date as unknown as string }))
}

export async function addCreditTask(userId: number, data: Partial<CreditTask>): Promise<number> {
  const db = getDb()
  const result = await db.prepare(
    `INSERT INTO budget_credit_tasks (user_id, title, type, status, target_date, bureau, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).run(
    userId,
    data.title || 'Credit task',
    data.type || 'report_review',
    data.status || 'pending',
    data.target_date || null,
    data.bureau || null,
    data.notes || ''
  )
  return Number(result.lastInsertRowid)
}

export async function updateCreditTask(userId: number, id: number, data: Partial<CreditTask>): Promise<void> {
  const db = getDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (data.title !== undefined) { sets.push('title = ?'); values.push(data.title) }
  if (data.type !== undefined) { sets.push('type = ?'); values.push(data.type) }
  if (data.status !== undefined) {
    sets.push('status = ?')
    values.push(data.status)
    sets.push('completed_at = ?')
    values.push(data.status === 'done' ? new Date().toISOString() : null)
  }
  if (data.target_date !== undefined) { sets.push('target_date = ?'); values.push(data.target_date || null) }
  if (data.bureau !== undefined) { sets.push('bureau = ?'); values.push(data.bureau || null) }
  if (data.notes !== undefined) { sets.push('notes = ?'); values.push(data.notes || '') }
  if (sets.length === 0) return
  values.push(userId, id)
  await db.prepare(`UPDATE budget_credit_tasks SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`).run(...values)
}

export async function deleteCreditTask(userId: number, id: number): Promise<void> {
  const db = getDb()
  await db.prepare('DELETE FROM budget_credit_tasks WHERE user_id = ? AND id = ?').run(userId, id)
}
