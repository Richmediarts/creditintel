import { describe, expect, it } from 'vitest'
import { onlineDisputeOptions, prefillOnlineDispute } from '@/lib/utils/online-dispute-items'
import type { DisputeItem } from '@/types'
const item=(overrides:Partial<DisputeItem>={}):DisputeItem=>({accountId:'sample-a',creditorName:'Sample Creditor',bureau:'Experian',derogatoryType:'Charge Off',inaccuracies:['balance'],reasons:['Review balance'],recommendedAction:'Review',...overrides})
describe('online dispute item selection',()=>{
 it('uses the same derogatory categories as the Derogatory Accounts page',()=>expect(onlineDisputeOptions([item(),item({accountId:'good',derogatoryType:undefined})])).toHaveLength(1))
 it('keeps the same creditor on different bureaus separate',()=>{const options=onlineDisputeOptions([item(),item({bureau:'Equifax'})]);expect(options).toHaveLength(2);expect(options[0].id).not.toBe(options[1].id)})
 it('keeps distinct accounts and removes exact repeated items',()=>{expect(onlineDisputeOptions([item(),item(),item({accountId:'sample-b'})])).toHaveLength(2)})
 it('prefills the creditor, bureau, and only report-supplied reasons',()=>{expect(prefillOnlineDispute(item({bureau:'TransUnion',inaccuracies:['late_payment']}))).toEqual({creditorName:'Sample Creditor',bureau:'TransUnion',letterType:'dispute',inaccuracies:['late_payment']})})
 it('does not invent reasons for a collection without flagged inaccuracies',()=>{expect(prefillOnlineDispute(item({derogatoryType:'Collection',inaccuracies:[]})).inaccuracies).toEqual([])})
 it('copies reasons instead of modifying the original report',()=>{const source=item();const result=prefillOnlineDispute(source);result.inaccuracies.push('duplicate');expect(source.inaccuracies).toEqual(['balance'])})
})
