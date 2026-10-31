import { describe, expect, it } from 'vitest'
import { classifyTransaction, reconcileWindow, reconcilePlanPeriods, reconcileTotals, type ReconTx } from '@/lib/utils/reconcile'
const tx = (props: Partial<ReconTx> = {}): ReconTx => ({ date: '2026-11-06', description: 'Groceries', amount: -40, category: 'FOOD_AND_DRINK', accountKind: 'bank', accountName: 'Checking', accountOwner: 'me', ...props })
const window = (transactions: ReconTx[]) => reconcileWindow({ index: 0, start: '2026-11-06', end: '2026-11-19', planned: 500, plannedIncomeExpected: 2000, plannedIncomeReceived: 0, transactions })
describe('pay-period reconciliation', () => {
  it('counts card purchases once and keeps subsequent bank payments separate', () => {
    const result = window([tx({ accountKind: 'credit', amount: -100 }), tx({ description: 'Credit card payment', category: 'TRANSFER_OUT', categoryDetail: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT', amount: -100 }), tx({ accountKind: 'credit', amount: 100 })])
    expect(result.spendingActual).toBe(100)
    expect(result.cardPayments).toBe(100)
    expect(result.cardCredits).toBe(100)
    expect(result.delta).toBe(400)
    expect(result.incomeActual).toBe(0)
  })
  it('excludes transfers in both directions from income and spending', () => {
    const r=window([tx({ category: 'TRANSFER_OUT', amount: -200 }),tx({ category: 'TRANSFER_IN', amount: 200 })])
    expect(r.spendingActual).toBe(0); expect(r.incomeActual).toBe(0)
    expect(r.transfersIn).toBe(200); expect(r.transfersOut).toBe(200)
  })
  it('does not confuse shopping at a card issuer with a card payment', () => {
    expect(classifyTransaction(tx({ description: 'Amazon Marketplace', category: 'GENERAL_MERCHANDISE' }), ['amazon'] ).kind).toBe('spending')
    expect(classifyTransaction(tx({ category: 'PAYMENT', description: 'Electric utility' })).kind).toBe('spending')
  })
  it('counts uncategorized expenses and makes them visible', () => {
    const r=window([tx({ category: null })]); expect(r.spendingActual).toBe(40)
    expect(r.uncategorizedSpendingCount).toBe(1); expect(r.byCategory[0].category).toBe('UNCATEGORIZED')
  })
  it('uses inclusive period boundaries and assigns next payday only to the next window', () => {
    const rows=[tx({ date: '2026-11-06',amount: -10 }),tx({ date: '2026-11-19',amount: -20 }),tx({ date: '2026-11-20',amount: -30 })]
    const result=reconcilePlanPeriods([{ index:0,start:'2026-11-06',end:'2026-11-19',totalOutgoing:100,expectedTotal:0,receivedTotal:0 },{ index:1,start:'2026-11-20',end:'2026-12-03',totalOutgoing:100,expectedTotal:0,receivedTotal:0 }],rows)
    expect(result.map(w=>w.spendingActual)).toEqual([30,30]); expect(reconcileTotals(result).spendingActual).toBe(60)
  })
  it('attributes shared, spouse, and unassigned spending without losing amounts', () => {
    const r=window([tx({ amount:-10 }),tx({ amount:-20,accountOwner:'wife' }),tx({ amount:-30,accountOwner:'shared' }),tx({ amount:-40,accountOwner:null })])
    expect(r.bySpouse).toEqual({me:10,wife:20,shared:30,unassigned:40}); expect(r.spendingActual).toBe(100)
  })
  it('ignores invalid, zero and outside-window amounts and rounds cents', () => {
    const r=window([tx({amount:NaN}),tx({amount:0}),tx({amount:-900,date:'2026-11-05'}),tx({amount:-0.1}),tx({amount:-0.2})])
    expect(r.spendingActual).toBe(0.3); expect(r.count).toBe(2)
  })
  it('does not classify credits on a card as new paycheck income', () => {
    expect(window([tx({accountKind:'credit',amount:75})]).incomeActual).toBe(0)
  })
})
