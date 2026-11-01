import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const state=vi.hoisted(()=>({run:vi.fn(),deadline:vi.fn()}))
vi.mock('@/lib/auth',()=>({verifyToken:()=>({userId:1})}))
vi.mock('@/lib/db',()=>({getDb:()=>({run:state.run}),calculateExpectedResponseDateFrom:state.deadline}))
import { POST } from '@/app/api/disputes/route'
const request=(prepareOnly?:boolean)=>new NextRequest('http://localhost/api/disputes',{method:'POST',headers:{cookie:'credit-dashboard-token=test','content-type':'application/json'},body:JSON.stringify({creditorName:'Sample Creditor',bureau:'Experian',letterType:'dispute',inaccuracies:['balance'],method:'online',prepareOnly})})
beforeEach(()=>{vi.clearAllMocks();state.run.mockResolvedValue({lastInsertRowid:77});state.deadline.mockReturnValue('2026-12-01')})
describe('prepared dispute tracking',()=>{
 it('does not mark a prepared item as submitted or start a filing deadline',async()=>{expect((await POST(request(true))).status).toBe(201);const values=state.run.mock.calls[0][1];expect(values[4]).toBe('pending');expect(values[8]).toBeNull();expect(values[9]).toBeNull();expect(values[11]).toBeNull();expect(state.deadline).not.toHaveBeenCalled()})
 it('preserves the existing submitted-dispute behavior for other callers',async()=>{expect((await POST(request())).status).toBe(201);const values=state.run.mock.calls[0][1];expect(values[4]).toBe('sent');expect(values[8]).toBeTruthy();expect(values[9]).toBe('2026-12-01');expect(values[11]).toBeTruthy()})
})
