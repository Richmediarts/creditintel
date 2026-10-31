import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const state=vi.hoisted(()=>({auth:{userId:1,isExample:false},createdBy:1,get:vi.fn(),run:vi.fn()}))
vi.mock('@/lib/auth',()=>({verifyToken:()=>state.auth}))
vi.mock('@/lib/db',()=>({getDb:()=>({prepare:()=>({get:state.get,run:state.run})})}))
vi.mock('@/lib/household-db',()=>({getOrCreateHousehold:async()=>({id:7,created_by:state.createdBy}),getHouseholdMembers:vi.fn(),updateHousehold:vi.fn(),resolveBudgetUserId:vi.fn(),setShareLevel:vi.fn(),getMemberContributions:vi.fn(),addMemberContribution:vi.fn()}))
import {POST,PATCH} from '@/app/api/budget/household/route'
const req=(method:string,body:unknown)=>new NextRequest('http://localhost/api/budget/household',{method,headers:{cookie:'credit-dashboard-token=test','content-type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=>{vi.clearAllMocks();state.createdBy=1;state.auth.isExample=false})
describe('household invitations',()=>{
 it('rejects email-only joining without reading financial records',async()=>{expect((await POST(req('POST',{owner_email:'someone@example.com'}))).status).toBe(400);expect(state.get).not.toHaveBeenCalled()})
 it('requires an owner to generate an invitation',async()=>{state.createdBy=2;expect((await PATCH(req('PATCH',{create_invite:true}))).status).toBe(403);expect(state.run).not.toHaveBeenCalled()})
 it('stores only the invitation hash, with a 24-hour expiry',async()=>{state.run.mockResolvedValue({changes:1});const response=await PATCH(req('PATCH',{create_invite:true}));const data=await response.json();expect(data.invite_code).toMatch(/^[a-f0-9]{48}$/);expect(state.run.mock.calls[0][0]).toMatch(/^[a-f0-9]{64}$/);expect(state.run.mock.calls[0][0]).not.toBe(data.invite_code)})
 it('rejects expired or already consumed invitations',async()=>{state.get.mockResolvedValue(undefined);expect((await POST(req('POST',{invite_code:'a'.repeat(48)}))).status).toBe(400)})
})
