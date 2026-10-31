import { beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/db', () => ({ getDb: () => state.db }))
import { getReconciliationTransactions, upsertPlaidTransaction } from '@/lib/budget-db'
let sqlite: Database.Database
beforeEach(() => {
  if (sqlite) sqlite.close()
  sqlite = new Database(':memory:')
  sqlite.exec(`CREATE TABLE budget_bank_accounts (id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT, owner TEXT);
    CREATE TABLE budget_credit_cards (id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT, owner TEXT);
    CREATE TABLE budget_transactions (id INTEGER PRIMARY KEY, user_id INTEGER, account_id INTEGER, date TEXT, description TEXT, amount REAL, balance REAL, category TEXT, category_detail TEXT, account_kind TEXT, plaid_transaction_id TEXT);
    INSERT INTO budget_bank_accounts VALUES (1,1,'Checking','me'),(2,2,'Other user bank','wife');
    INSERT INTO budget_credit_cards VALUES (1,1,'Card','wife'),(2,1,'My card','shared');`)
  state.db = { prepare: (sql: string) => ({
    all: async (...args: unknown[]) => sqlite.prepare(sql).all(...args),
    get: async (...args: unknown[]) => sqlite.prepare(sql).get(...args),
    run: async (...args: unknown[]) => sqlite.prepare(sql).run(...args),
  }) }
})
function add(id: number, accountId: number, kind: string | null) {
  sqlite.prepare("INSERT INTO budget_transactions (id,user_id,account_id,date,description,amount,category,category_detail,account_kind) VALUES (?,1,?,'2026-11-06','Shop',-25,'GENERAL_MERCHANDISE','DETAIL',?)").run(id,accountId,kind)
}
describe('transaction account resolution', () => {
  it('keeps bank and card identities distinct when their ids overlap',async()=>{
    add(1,1,'bank');add(2,1,'credit')
    const rows=await getReconciliationTransactions(1,'2026-11-06','2026-11-19')
    expect(rows.map(r=>[r.accountKind,r.accountName,r.accountOwner])).toEqual([['bank','Checking','me'],['credit','Card','wife']])
    expect(rows[0].categoryDetail).toBe('DETAIL')
  })
  it('keeps legacy collisions unresolved instead of assigning the wrong owner',async()=>{
    add(1,1,null);const [r]=await getReconciliationTransactions(1,'2026-11-06','2026-11-19');expect(r.accountKind).toBeNull();expect(r.accountName).toBeNull()
  })
  it('never uses another users account to resolve a transaction',async()=>{
    add(1,2,null);const [r]=await getReconciliationTransactions(1,'2026-11-06','2026-11-19');expect(r.accountName).toBe('My card');expect(r.accountKind).toBe('credit')
    expect(await getReconciliationTransactions(2,'2026-11-06','2026-11-19')).toEqual([])
  })
  it('persists account kind on insert and repairs it when Plaid re-syncs',async()=>{
    await upsertPlaidTransaction(1,1,'plaid-test','2026-11-06','Purchase',-40,0,true)
    expect(sqlite.prepare('SELECT account_kind FROM budget_transactions').get()).toEqual({account_kind:'credit'})
    await upsertPlaidTransaction(1,1,'plaid-test','2026-11-07','Purchase',-41,0,false)
    expect(sqlite.prepare('SELECT account_kind,amount FROM budget_transactions').get()).toEqual({account_kind:'bank',amount:-41})
  })
})
