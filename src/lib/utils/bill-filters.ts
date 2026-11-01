export interface BillFilters {
  payee: string; owner: string; dueFrom: string; dueTo: string;
  plannedFrom: string; plannedTo: string; minAmount: string; maxAmount: string;
}
export const EMPTY_BILL_FILTERS: BillFilters = {
  payee: '', owner: '', dueFrom: '', dueTo: '', plannedFrom: '', plannedTo: '', minAmount: '', maxAmount: '',
}
interface FilterableBill {
  payee_name?: string; owner?: string; due_date?: string | null; due_date_status?: string;
  planned_payment_date?: string | null; amount?: number | null; amount_status?: string;
}
function inRange(value: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true
  if (!value) return false
  const date = value.slice(0, 10)
  return (!from || date >= from) && (!to || date <= to)
}
export function filterBills<T extends FilterableBill>(bills: T[], filters: BillFilters): T[] {
  const query = filters.payee.trim().toLocaleLowerCase().replace(/[’‘]/g, "'")
  return bills.filter(bill => {
    const payee = (bill.payee_name || '').toLocaleLowerCase().replace(/[’‘]/g, "'")
    if (query && !payee.includes(query)) return false
    if (filters.owner && (bill.owner || 'me') !== filters.owner) return false
    if (!inRange(bill.due_date_status === 'missing' ? null : bill.due_date, filters.dueFrom, filters.dueTo)) return false
    if (!inRange(bill.planned_payment_date, filters.plannedFrom, filters.plannedTo)) return false
    if (filters.minAmount !== '' || filters.maxAmount !== '') {
      if (bill.amount_status === 'missing' || bill.amount == null || !Number.isFinite(Number(bill.amount))) return false
      const amount = Number(bill.amount)
      if (filters.minAmount !== '' && amount < Number(filters.minAmount)) return false
      if (filters.maxAmount !== '' && amount > Number(filters.maxAmount)) return false
    }
    return true
  })
}
