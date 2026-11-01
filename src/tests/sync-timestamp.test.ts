import { describe, expect, it } from 'vitest'
import { formatSyncedAt } from '@/lib/utils/sync-timestamp'
describe('Eastern bank sync timestamps', () => {
  it('converts the reported November UTC time to Eastern standard time', () => {
    expect(formatSyncedAt('2026-11-01T14:50:37.031Z')).toBe('11/01/26 09:50am EST')
  })
  it('uses daylight time in summer',()=>{expect(formatSyncedAt('2026-07-01T14:50:00Z')).toBe('07/01/26 10:50am EDT')})
  it('handles both sides of the fall clock change',()=>{
    expect(formatSyncedAt('2026-11-01T05:30:00Z')).toBe('11/01/26 01:30am EDT')
    expect(formatSyncedAt('2026-11-01T06:30:00Z')).toBe('11/01/26 01:30am EST')
  })
  it('handles both sides of the spring clock change',()=>{
    expect(formatSyncedAt('2026-03-08T06:30:00Z')).toBe('03/08/26 01:30am EST')
    expect(formatSyncedAt('2026-03-08T07:30:00Z')).toBe('03/08/26 03:30am EDT')
  })
  it('interprets legacy timezone-free UTC data consistently',()=>{expect(formatSyncedAt('2026-11-01 14:50:37.031')).toBe('11/01/26 09:50am EST')})
  it('respects explicit offsets and Eastern date rollover',()=>{
    expect(formatSyncedAt('2026-11-01T09:50:00-05:00')).toBe('11/01/26 09:50am EST')
    expect(formatSyncedAt('2026-11-02T02:00:00Z')).toBe('11/01/26 09:00pm EST')
  })
  it('leaves missing or invalid timestamps blank',()=>{for(const v of [null,undefined,'','not-a-date']) expect(formatSyncedAt(v)).toBe('')})
})
