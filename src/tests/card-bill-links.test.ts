import { describe, expect, it } from 'vitest'
import { matchBillCard, planCardBillLinks, canRemoveDuplicate, cardHasPlannedBill } from '@/lib/utils/card-bill-links'
import { groupBillsByCategory } from '@/lib/utils/billCategories'
const cards=[{id:1,name:'Capital One',last_four:'1111',owner:'me'},{id:2,name:'Capital One',last_four:'2222',owner:'me'},{id:3,name:'Credit One Bank',last_four:'1111',owner:'me'},{id:4,name:'Rich’s Apple Card',last_four:'3333',owner:'me'},{id:5,name:'Mission Lane',last_four:'4444',owner:'me'}]
describe('credit card bill identity',()=>{
 it('distinguishes multiple cards from the same issuer by last four',()=>{expect(matchBillCard({id:10,payee_name:"Rich's Cap1-2222",is_recurring:1},cards)).toBe(2)})
 it('does not confuse different issuers sharing last four digits',()=>{expect(matchBillCard({id:10,payee_name:'Credit One AMEX 1111',is_recurring:1},cards)).toBe(3)})
 it('does not guess a generic issuer or unmatched old number',()=>{expect(matchBillCard({id:10,payee_name:'Capital One'},cards)).toBeNull();expect(matchBillCard({id:10,payee_name:'Capital One-9999'},cards)).toBeNull()})
 it('matches apostrophe variants while keeping spouse bills separate',()=>{expect(matchBillCard({id:10,payee_name:"Rich's Apple Card",owner:'me'},cards)).toBe(4);expect(matchBillCard({id:10,payee_name:"Ella's Apple Card",owner:'wife'},cards)).toBeNull()})
 it('respects explicit card links and leaves one-off extra payments separate',()=>{expect(matchBillCard({id:10,payee_name:'Capital One',credit_card_id:2},cards)).toBe(2);expect(matchBillCard({id:10,payee_name:'Mission Lane',is_recurring:0},cards)).toBeNull()})
 it('keeps the established bill and removes only unused duplicates',()=>{
  const bills=[{id:10,payee_name:'Mission Lane',is_recurring:1,paid_date:'2026-10-01'},{id:20,payee_name:'Mission Lane',credit_card_id:5,is_recurring:1}]
  expect(planCardBillLinks(bills,cards)).toEqual([{cardId:5,keepBillId:10,removeBillIds:[20],protectedBillIds:[]}])
 })
 it('protects payment history, partial payments, notes, and planned dates',()=>{
  for(const data of [{is_paid:1},{paid_date:'2026-10-01'},{paid_amount:5},{notes:'Keep this'},{planned_payment_date:'2026-11-03'}])expect(canRemoveDuplicate({id:1,...data})).toBe(false)
  const plan=planCardBillLinks([{id:10,payee_name:'Mission Lane',is_recurring:1,paid_amount:5},{id:20,payee_name:'Mission Lane',is_recurring:1,notes:'Keep'}],cards)
  expect(plan[0].protectedBillIds).toEqual([20])
 })
 it('groups linked generic card names under Credit Cards instead of Other Bills',()=>{
  const bill={id:10,payee_name:'Capital One',credit_card_id:2,amount:50,due_date:'2026-11-03'}
  const result=groupBillsByCategory([bill]);expect(result.groups.find(g=>g.title==='Credit Cards')?.items).toEqual([bill]);expect(result.unmatched).toEqual([])
 })
})

describe('confirmed replacement card mapping',()=>{
 it('keeps both histories identified for deliberate archival when numbers changed',()=>{
  const bills=[{id:10,payee_name:'Capital One-1111',is_recurring:1,paid_date:'2026-10-01'},{id:11,payee_name:'Capital One-9999',is_recurring:1,paid_date:'2026-09-01'}]
  const plan=planCardBillLinks(bills,cards,{11:1});expect(plan[0]).toEqual({cardId:1,keepBillId:10,removeBillIds:[],protectedBillIds:[11]})
 })
})

describe('linked bills in debt estimates',()=>{
 it('uses the card id even when bill and card names differ',()=>{expect(cardHasPlannedBill(1,[{id:10,payee_name:'Old card name',credit_card_id:1,amount:50}],cards)).toBe(true)})
 it('does not suppress a different card estimate just because issuer names match',()=>{expect(cardHasPlannedBill(2,[{id:10,payee_name:'Capital One',credit_card_id:1,amount:50}],cards)).toBe(false)})
 it('does not treat missing amounts as funded minimum payments',()=>{expect(cardHasPlannedBill(1,[{id:10,credit_card_id:1,amount:50,amount_status:'missing'}],cards)).toBe(false)})
})
