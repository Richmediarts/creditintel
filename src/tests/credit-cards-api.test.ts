import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const state=vi.hoisted(()=>({getCards:vi.fn(),syncBills:vi.fn(),auth:{userId:1}}))
vi.mock('@/lib/auth',()=>({verifyToken:()=>state.auth}))
vi.mock('@/lib/budget-db',()=>({getCreditCards:state.getCards,syncAllCreditCardsToBills:state.syncBills,getCreditCard:vi.fn(),addCreditCard:vi.fn(),updateCreditCard:vi.fn(),deleteCreditCard:vi.fn(),clearCreditCardPlaid:vi.fn(),getBillsByCreditCard:vi.fn()}))
import { GET } from '@/app/api/budget/credit-cards/route'
const request=(auth=true)=>new NextRequest('http://localhost/api/budget/credit-cards',{headers:auth?{cookie:'credit-dashboard-token=test'}:{}})
beforeEach(()=>{vi.clearAllMocks();state.auth.userId=1;state.syncBills.mockRejectedValue(new Error('Invalid bill date'))})
describe('read-only credit card listing',()=>{
 it('returns stored cards even when bill synchronization would fail',async()=>{
  const cards=[{id:1,name:'Sample Card',due_date:''}];state.getCards.mockResolvedValue(cards)
  const response=await GET(request());expect(response.status).toBe(200);expect(await response.json()).toEqual({cards});expect(state.getCards).toHaveBeenCalledWith(1);expect(state.syncBills).not.toHaveBeenCalled()
 })
 it('requires authentication before reading cards',async()=>{expect((await GET(request(false))).status).toBe(401);expect(state.getCards).not.toHaveBeenCalled()})
 it('returns a loading error rather than a misleading empty card list',async()=>{
  state.getCards.mockRejectedValue(new Error('database temporarily unavailable'));const log=vi.spyOn(console,'error').mockImplementation(()=>{});const response=await GET(request());expect(response.status).toBe(500);const body=await response.json();expect(body.error).toContain('Unable to load');expect(body).not.toHaveProperty('cards');log.mockRestore()
 })
 it('returns a genuine empty list only when the query succeeds with no cards',async()=>{state.getCards.mockResolvedValue([]);const response=await GET(request());expect(await response.json()).toEqual({cards:[]})})
})
