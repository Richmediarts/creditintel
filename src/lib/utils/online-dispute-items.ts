import type { DisputeItem } from '@/types'
import { isDisputableItem } from '@/lib/utils/analysis'

export function onlineDisputeOptions(items: DisputeItem[]) {
  const seen = new Set<string>()
  return items.filter(isDisputableItem).flatMap(item => {
    const id = JSON.stringify([item.bureau, item.accountId, item.creditorName])
    if (seen.has(id)) return []
    seen.add(id)
    return [{ id, item, label: `${item.creditorName} — ${item.bureau} — ${item.derogatoryType}` }]
  })
}

export function prefillOnlineDispute(item: DisputeItem) {
  return { creditorName: item.creditorName, bureau: item.bureau, letterType: 'dispute' as const, inaccuracies: [...new Set(item.inaccuracies || [])] }
}
