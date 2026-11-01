import { beforeEach, describe, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({get:vi.fn(),all:vi.fn(),run:vi.fn()}))
vi.mock('@/lib/db',()=>({getDb:()=>({prepare:()=>({get:state.get,all:state.all,run:state.run})})}))
import { addBill } from '@/lib/budget-db'
import { DuplicateCardBillError } from '@/lib/utils/card-bill-links'
beforeEach(()=>{vi.clearAllMocks();state.get.mockResolvedValue({id:44});state.run.mockResolvedValue({lastInsertRowid:55})})
describe('recurring card bill creation',()=>{
 it('blocks a second recurring obligation for the same linked card',async()=>{await expect(addBill(1,{credit_card_id:12,is_recurring:1,payee_name:'Card'})).rejects.toBeInstanceOf(DuplicateCardBillError);expect(state.run).not.toHaveBeenCalled()})
 it('keeps an intentional one-time extra payment separate',async()=>{expect(await addBill(1,{credit_card_id:12,is_recurring:0,payee_name:'Extra payoff',amount:50})).toBe(55);expect(state.get).not.toHaveBeenCalled();expect(state.run).toHaveBeenCalledOnce()})
})
