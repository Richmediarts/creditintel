import { describe, expect, it } from 'vitest'
import { normalizeCreditPlanScores } from '@/lib/utils/credit-plan-scores'

describe('credit-plan FICO API contract', () => {
  it('converts the real bureau-keyed API response into safely searchable scores', () => {
    const scores = normalizeCreditPlanScores({ Experian: {score: 680,dateUpdated:'2026-11-01'}, Equifax:{score:700},TransUnion:{score:null} })
    expect(scores.find(s=>s.bureau==='Experian')?.score).toBe(680)
    expect(scores.find(s=>s.bureau==='Equifax')?.score).toBe(700)
    expect(scores.find(s=>s.bureau==='TransUnion')?.score).toBeNull()
  })
  it('handles empty or missing API data without a render crash',()=>{
    for(const value of [null,undefined,{},false,'unavailable']) expect(normalizeCreditPlanScores(value)).toEqual([])
  })
  it('retains compatibility with score arrays',()=>{
    expect(normalizeCreditPlanScores([{bureau:'Experian',score:680}])).toEqual([{bureau:'Experian',score:680}])
  })
  it('keeps malformed scores unknown instead of inventing numbers',()=>{
    expect(normalizeCreditPlanScores({Experian:{score:'680'},Equifax:null})).toEqual([{bureau:'Experian',score:null},{bureau:'Equifax',score:null}])
  })
})
