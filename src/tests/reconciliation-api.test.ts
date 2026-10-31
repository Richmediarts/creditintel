import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks=vi.hoisted(()=>({ auth:{userId:1,isExample:false},owner:1,run:vi.fn(),all:vi.fn() }))
vi.mock('@/lib/auth',()=>({verifyToken:()=>mocks.auth}))
vi.mock('@/lib/db',()=>({getDb:()=>({prepare:()=>({run:mocks.run,all:mocks.all})})}))
vi.mock('@/lib/household-db',()=>({resolveBudgetUserId:async()=>mocks.owner}))
vi.mock('@/lib/payperiod-planner',()=>({getPayPeriodReconciliation:async()=>({windows:[]})}))
import {GET,PATCH} from '@/app/api/budget/reconciliation/route'
const request=(method='GET',body?:unknown,query='',authenticated=true)=>new NextRequest('http://localhost/api/budget/reconciliation'+query,{method,headers:{...(authenticated?{cookie:'credit-dashboard-token=test'}:{}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
beforeEach(()=>{vi.clearAllMocks();mocks.auth={userId:1,isExample:false};mocks.owner=1;mocks.all.mockResolvedValue([]);mocks.run.mockResolvedValue({changes:1})})
describe('reconciliation access and validation',()=>{
  it('requires authentication before reading financial data',async()=>{expect((await GET(request('GET',undefined,'',false))).status).toBe(401);expect(mocks.all).not.toHaveBeenCalled()})
  it('rejects invalid dates and unbounded period counts',async()=>{expect((await GET(request('GET',undefined,'?payday=2026-02-30'))).status).toBe(400);expect((await GET(request('GET',undefined,'?periods=10000'))).status).toBe(400)})
  it('prevents household members from reassigning the owners accounts',async()=>{mocks.owner=2;expect((await PATCH(request('PATCH',{id:1,kind:'bank',owner:'wife'}))).status).toBe(403);expect(mocks.run).not.toHaveBeenCalled()})
  it('preserves example-account read-only access',async()=>{mocks.auth.isExample=true;expect((await PATCH(request('PATCH',{id:1,kind:'bank',owner:'wife'}))).status).toBe(403);expect(mocks.run).not.toHaveBeenCalled()})
  it('validates account kind and owner before building SQL',async()=>{expect((await PATCH(request('PATCH',{id:1,kind:'invalid',owner:'wife'}))).status).toBe(400);expect(mocks.run).not.toHaveBeenCalled()})
  it('scopes account assignment to the authenticated budget owner',async()=>{expect((await PATCH(request('PATCH',{id:3,kind:'credit',owner:'shared'}))).status).toBe(200);expect(mocks.run).toHaveBeenCalledWith('shared',3,1)})
})
