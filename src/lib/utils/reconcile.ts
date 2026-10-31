/**
 * Planned-vs-actual expense reconciliation per pay period.
 *
 * Pure functions over `budget_transactions` rows — same money rules as
 * lib/utils/payperiod.ts, extended with the reconciliation double-count
 * guards:
 *
 *  - Transfers between our own accounts (Plaid PERSONAL_FINANCE_CATEGORY
 *    TRANSFER_IN / TRANSFER_OUT) are NEVER income or spending. Moving money
 *    from checking to savings is not a new sale.
 *  - A credit-card purchase counts ONCE, when the card is charged (credit
 *    stream). The later payment glimpsed in the bank stream is "cash leaving
 *    the bank", reported separately as cardPayments, never re-counted as
 *    spending.
 *  - Credits received on a card account (refunds / payments applied) are
 *    excluded from income and spending; they settle purchases already counted.
 *  - A pay period covers [start, end] inclusive — identical to the bill
 *    assignment rules: a transaction dated on the next payday belongs to the
 *    NEXT period.
 *  - Uncategorized spending still must COUNT (money left the bank); it is
 *    grouped as UNCATEGORIZED and surfaced with a count so nothing silently
 *    vanishes.
 */

export type SpouseKey = 'me' | 'wife' | 'shared'

/** One normalized row of budget_transactions (bank + credit merged). */
export interface ReconTx {
  id?: number
  date: string
  description: string
  /** amount < 0 = money out, amount > 0 = money in (Plaid ingest negates). */
  amount: number
  category?: string | null
  categoryDetail?: string | null
  accountKind: 'bank' | 'credit'
  accountName: string
  accountOwner?: SpouseKey | null
}

/** How a transaction was treated by the reconciliation rules. */
export type ReconKind = 'spending' | 'income' | 'transfer' | 'cardPayment' | 'cardCredit'

export interface Classification {
  kind: ReconKind
  category: string
  owner: SpouseKey | 'unassigned'
}

function normCat(v?: string | null): string {
  const s = String(v || '').trim().toUpperCase()
  return s
}

/** Category metadata is authoritative. Merchant-name matching alone can
 * mistake shopping at a card issuer's store for a card payment. */
export function classifyTransaction(tx: ReconTx, _cardNames: string[] = []): Classification {
  const category = normCat(tx.category) || 'UNCATEGORIZED'
  const detail = normCat(tx.categoryDetail)
  const owner = ['me', 'wife', 'shared'].includes(tx.accountOwner || '')
    ? tx.accountOwner as SpouseKey : 'unassigned'
  const payment = detail.includes('CREDIT_CARD_PAYMENT') ||
    category === 'CREDIT_CARD_PAYMENT' ||
    /(?:credit[ -]?card|cardmember)\s+(?:auto\s*pay|payment|pmt)|payment\s+(?:to|for)\s+(?:.*\s)?(?:credit[ -]?card|cardmember)/i.test(tx.description || '')
  if (tx.accountKind === 'credit') {
    return { kind: tx.amount < 0 ? 'spending' : 'cardCredit', category: tx.amount < 0 ? category : 'CARD_CREDIT', owner }
  }
  // A card payment can arrive labeled TRANSFER_OUT; test explicit payment evidence first.
  if (tx.amount < 0 && payment) return { kind: 'cardPayment', category: 'CARD_PAYMENT', owner }
  if (category === 'TRANSFER_IN' || category === 'TRANSFER_OUT') return { kind: 'transfer', category, owner }
  if (tx.amount > 0) return { kind: 'income', category, owner }
  return { kind: 'spending', category, owner }
}

export interface WindowReconcile {
  index: number
  start: string
  end: string
  /** Planned outgoing (bills + allowances + reserves + planned debt). */
  planned: number
  /** Expected (not yet received) scheduled pay. */
  plannedIncomeExpected: number
  /** Pay that had already landed when the plan was built. */
  plannedIncomeReceived: number

  /** Spending counted by the rules (card purchases + bank debits). */
  spendingActual: number
  /** Non-transfer income that actually landed in bank accounts. */
  incomeActual: number
  /** Card payments seen as cash out of the bank — NOT spending again. */
  cardPayments: number
  count: number

  transfersOut: number
  transfersIn: number
  /** Card-stream credits (refunds/payments) — excluded everywhere. */
  cardCredits: number

  uncategorizedSpendingCount: number

  byCategory: { category: string; amount: number; count: number }[]
  byAccount: { account: string; owner: SpouseKey | 'unassigned'; amount: number; count: number }[]
  bySpouse: Record<SpouseKey | 'unassigned', number>
  /** Planned allocations minus recorded purchases; card payments stay separate. */
  delta: number
}

export interface WindowInput {
  index: number
  start: string
  end: string
  planned: number
  plannedIncomeExpected: number
  plannedIncomeReceived: number
  transactions: ReconTx[]
  cardNames?: string[]
}

export function reconcileWindow(input: WindowInput): WindowReconcile {
  const cardNames = input.cardNames || []
  const byCategory = new Map<string, { amount: number; count: number }>()
  const byAccount = new Map<string, { owner: SpouseKey | 'unassigned'; amount: number; count: number }>()
  const bySpouse: Record<SpouseKey | 'unassigned', number> = {
    me: 0,
    wife: 0,
    shared: 0,
    unassigned: 0,
  }
  const acc: WindowReconcile = {
    index: input.index,
    start: input.start,
    end: input.end,
    planned: round2(input.planned),
    plannedIncomeExpected: round2(Math.max(0, input.plannedIncomeExpected)),
    plannedIncomeReceived: round2(Math.max(0, input.plannedIncomeReceived)),
    spendingActual: 0,
    incomeActual: 0,
    cardPayments: 0,
    count: 0,
    transfersOut: 0,
    transfersIn: 0,
    cardCredits: 0,
    uncategorizedSpendingCount: 0,
    byCategory: [],
    byAccount: [],
    bySpouse,
    delta: 0,
  }

  for (const tx of input.transactions) {
    const d = String(tx.date || '').slice(0, 10)
    if (d < input.start || d > input.end) continue
    // Skip zero/unknown amounts — a vanished debit must never pad the plan.
    if (tx.amount === 0 || !Number.isFinite(tx.amount)) continue
    const cls = classifyTransaction(tx, cardNames)
    const abs = Math.abs(tx.amount)

    switch (cls.kind) {
      case 'spending': {
        acc.spendingActual += abs
        if (cls.category === 'UNCATEGORIZED') acc.uncategorizedSpendingCount++
        const catEntry = byCategory.get(cls.category) || { amount: 0, count: 0 }
        catEntry.amount += abs
        catEntry.count++
        byCategory.set(cls.category, catEntry)
        const accountKey = JSON.stringify([tx.accountName, tx.accountKind, cls.owner])
        const acctEntry = byAccount.get(accountKey) || { owner: cls.owner, amount: 0, count: 0 }
        acctEntry.amount += abs
        acctEntry.count++
        byAccount.set(accountKey, acctEntry)
        bySpouse[cls.owner] += abs
        break
      }
      case 'income':
        acc.incomeActual += tx.amount
        break
      case 'transfer':
        if (tx.amount < 0) acc.transfersOut += abs
        else acc.transfersIn += tx.amount
        break
      case 'cardPayment':
        acc.cardPayments += abs
        break
      case 'cardCredit':
        acc.cardCredits += tx.amount
        break
    }
    acc.count++
  }

  acc.spendingActual = round2(acc.spendingActual)
  acc.incomeActual = round2(acc.incomeActual)
  acc.cardPayments = round2(acc.cardPayments)
  acc.transfersOut = round2(acc.transfersOut)
  acc.transfersIn = round2(acc.transfersIn)
  acc.cardCredits = round2(acc.cardCredits)
  for (const k of Object.keys(bySpouse) as (keyof typeof bySpouse)[]) {
    bySpouse[k] = round2(bySpouse[k])
  }
  acc.byCategory = [...byCategory.entries()]
    .map(([category, v]) => ({ category, amount: round2(v.amount), count: v.count }))
    .sort((a, b) => b.amount - a.amount)
  acc.byAccount = [...byAccount.entries()]
    .map(([key, v]) => ({ account: (JSON.parse(key) as string[])[0], owner: v.owner, amount: round2(v.amount), count: v.count }))
    .sort((a, b) => b.amount - a.amount)
  acc.delta = round2(acc.planned - acc.spendingActual)
  return acc
}

/** Minimal shape of one PeriodPlan row the bridge already computed. */
export interface PeriodPlanLike {
  index: number
  start: string
  end: string
  totalOutgoing: number
  expectedTotal: number
  receivedTotal: number
}

/** Reconcile every period of a built plan against the same transaction list. */
export function reconcilePlanPeriods(
  periods: PeriodPlanLike[],
  transactions: ReconTx[],
  cardNames: string[] = []
): WindowReconcile[] {
  return periods.map((p) =>
    reconcileWindow({
      index: p.index,
      start: p.start,
      end: p.end,
      planned: p.totalOutgoing,
      plannedIncomeExpected: p.expectedTotal,
      plannedIncomeReceived: p.receivedTotal,
      transactions,
      cardNames,
    })
  )
}

export interface ReconcileTotals {
  planned: number
  spendingActual: number
  incomeActual: number
  cardPayments: number
  transfersOut: number
  transfersIn: number
  cardCredits: number
  uncategorizedSpendingCount: number
  delta: number
}

/** Column sums across every reconciled window. */
export function reconcileTotals(windows: WindowReconcile[]): ReconcileTotals {
  const t: ReconcileTotals = {
    planned: 0,
    spendingActual: 0,
    incomeActual: 0,
    cardPayments: 0,
    transfersOut: 0,
    transfersIn: 0,
    cardCredits: 0,
    uncategorizedSpendingCount: 0,
    delta: 0,
  }
  for (const w of windows) {
    t.planned = round2(t.planned + w.planned)
    t.spendingActual = round2(t.spendingActual + w.spendingActual)
    t.incomeActual = round2(t.incomeActual + w.incomeActual)
    t.cardPayments = round2(t.cardPayments + w.cardPayments)
    t.transfersOut = round2(t.transfersOut + w.transfersOut)
    t.transfersIn = round2(t.transfersIn + w.transfersIn)
    t.cardCredits = round2(t.cardCredits + w.cardCredits)
    t.uncategorizedSpendingCount += w.uncategorizedSpendingCount
  }
  t.delta = round2(t.planned - t.spendingActual)
  return t
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
