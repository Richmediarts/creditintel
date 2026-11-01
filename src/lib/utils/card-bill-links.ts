export interface LinkCard { id: number; name: string; last_four?: string; owner?: string }
export interface LinkBill {
  id: number; payee_name?: string; credit_card_id?: number | null; owner?: string;
  is_recurring?: number; is_paid?: number; paid_date?: unknown; paid_amount?: number;
  notes?: string | null; planned_payment_date?: unknown; amount?: number | null; amount_status?: string;
}
function identity(name: string): string {
  return name.toLowerCase().replace(/[’‘]/g, "'").trim()
    .replace(/^(?:rich(?:ard)?|ella)(?:'s)?\s+/, '').replace(/[^a-z0-9]/g, '')
    .replace(/^creditone(?:bank|amex)$/, 'creditone')
}
function issuer(name: string): string {
  const key=identity(name)
  if (/capitalone|cap1/.test(key)) return 'capitalone'
  if (/creditone/.test(key)) return 'creditone'
  return key.replace(/\d{4}/g, '')
}
export function matchBillCard(bill: LinkBill, cards: LinkCard[]): number | null {
  if (bill.credit_card_id != null) return cards.some(c=>c.id===bill.credit_card_id) ? bill.credit_card_id : null
  if (bill.is_recurring === 0 || /auto loan|extra payoff|extra payment/i.test(bill.payee_name || '')) return null
  const owned=cards.filter(c=>(c.owner || 'me')===(bill.owner || 'me'))
  const digits=(bill.payee_name || '').match(/(?<!\d)\d{4}(?!\d)/g)
  const matches=digits?.length
    ? owned.filter(c=>c.last_four && digits.includes(c.last_four) && issuer(c.name)===issuer(bill.payee_name || ''))
    : owned.filter(c=>identity(c.name)===identity(bill.payee_name || ''))
  return matches.length===1 ? matches[0].id : null
}
export function canRemoveDuplicate(bill: LinkBill): boolean {
  return !bill.is_paid && !bill.paid_date && !(Number(bill.paid_amount)>0) &&
    !bill.planned_payment_date && !String(bill.notes || '').trim()
}
export function planCardBillLinks(bills: LinkBill[], cards: LinkCard[], overrides: Record<number, number> = {}) {
  const groups=new Map<number,LinkBill[]>()
  for(const bill of bills){if(bill.is_recurring!==1)continue;const card=overrides[bill.id] ?? matchBillCard(bill,cards);if(card!=null && !cards.some(c=>c.id===card))throw new Error('Override card not found');if(card!=null)groups.set(card,[...(groups.get(card)||[]),bill])}
  return [...groups.entries()].map(([cardId,rows])=>{
    const ranked=[...rows].sort((a,b)=>Number(canRemoveDuplicate(a))-Number(canRemoveDuplicate(b)) || a.id-b.id)
    const [keep,...rest]=ranked
    return {cardId,keepBillId:keep.id,removeBillIds:rest.filter(canRemoveDuplicate).map(b=>b.id),protectedBillIds:rest.filter(b=>!canRemoveDuplicate(b)).map(b=>b.id)}
  })
}

export class DuplicateCardBillError extends Error {
  readonly billId: number
  constructor(billId: number) {
    super('This card already has a recurring bill. Edit the existing bill instead.')
    this.name = 'DuplicateCardBillError'
    this.billId = billId
  }
}

/** Explicit card ids take priority over similar issuer/payee names. */
export function cardHasPlannedBill(cardId: number, bills: LinkBill[], cards: LinkCard[]): boolean {
  return bills.some(bill => !bill.is_paid && bill.amount_status !== 'missing' && Number(bill.amount) > 0 &&
    matchBillCard(bill,cards) === cardId)
}
