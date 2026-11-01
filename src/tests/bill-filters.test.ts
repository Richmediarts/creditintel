import { describe, expect, it } from 'vitest'
import { filterBills, EMPTY_BILL_FILTERS, type BillFilters } from '@/lib/utils/bill-filters'
const bills = [
 { id:1,payee_name:'Electric Company',owner:'me',due_date:'2026-11-05',planned_payment_date:'2026-11-01',amount:100 },
 { id:2,payee_name:'Spouse’s Card',owner:'wife',due_date:'2026-11-10',planned_payment_date:'2026-11-06',amount:200 },
 { id:3,payee_name:'Rent',owner:'shared',due_date:'2026-11-01',planned_payment_date:null,amount:1000 },
 { id:4,payee_name:'Unknown',due_date:null,planned_payment_date:null,amount:null,amount_status:'missing' },
 { id:5,payee_name:'Zero bill',due_date:'2026-11-20',amount:0 },
]
const ids=(filters:Partial<BillFilters>)=>filterBills(bills,{...EMPTY_BILL_FILTERS,...filters}).map(b=>b.id)
describe('household bill filters',()=>{
 it('shows every bill without filters, including unknown amounts',()=>expect(ids({})).toEqual([1,2,3,4,5]))
 it('searches payees case-insensitively and handles apostrophes',()=>{expect(ids({payee:' ELECTRIC '})).toEqual([1]);expect(ids({payee:"spouse's"})).toEqual([2])})
 it('filters ownership and treats legacy ownerless bills as Mine',()=>{expect(ids({owner:'wife'})).toEqual([2]);expect(ids({owner:'shared'})).toEqual([3]);expect(ids({owner:'me'})).toEqual([1,4,5])})
 it('uses inclusive due date boundaries',()=>expect(ids({dueFrom:'2026-11-05',dueTo:'2026-11-10'})).toEqual([1,2]))
 it('filters actual planned dates without falling back to due dates',()=>expect(ids({plannedFrom:'2026-11-01',plannedTo:'2026-11-06'})).toEqual([1,2]))
 it('filters amount ranges inclusively and preserves a known zero',()=>{expect(ids({minAmount:'100',maxAmount:'200'})).toEqual([1,2]);expect(ids({minAmount:'0',maxAmount:'0'})).toEqual([5])})
 it('combines all filters and supports one-sided ranges',()=>expect(ids({owner:'wife',payee:'card',dueTo:'2026-11-10',plannedFrom:'2026-11-06',minAmount:'150'})).toEqual([2]))
 it('does not mutate bill records and returns no results for reversed ranges',()=>{const before=JSON.stringify(bills);expect(ids({minAmount:'300',maxAmount:'100'})).toEqual([]);expect(JSON.stringify(bills)).toBe(before)})
 it('does not use placeholder dates or amounts explicitly marked missing',()=>{expect(filterBills([{due_date:'2026-11-05',due_date_status:'missing',amount:100,amount_status:'missing'}],{...EMPTY_BILL_FILTERS,dueFrom:'2026-11-01'})).toEqual([])})
})
