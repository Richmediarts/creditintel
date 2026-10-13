/**
 * Bill category grouping shared by the Bills page and the 50/30/20
 * Interactive Budget so both stay in sync.
 */

export interface BillCategory {
  title: string
  bills: string[]
}

export const BILL_CATEGORIES: BillCategory[] = [
  {
    title: 'Home & Utilities',
    bills: ['pennymac', 'brookside hoa fees (yrly)', 'truegreen', 'anthem', 'electric bill'],
  },
  {
    title: 'Transportation',
    bills: ['bridgecrest - sorento', 'capitalone auto loan', 'progressive', 'sorento fuel', 'jeep fuel'],
  },
  {
    title: 'Food & Personal',
    bills: ['groceries'],
  },
  {
    title: 'Internet / TV / Cell Phone / Home Security',
    bills: ['at&t wireless', 'xfinity', 'vivint security', 'security equipment (fortiva)'],
  },
  {
    title: 'Water/Gas/Electricity',
    bills: ['greystone power', 'gas south', 'paulding county water', 'community waste'],
  },
  {
    title: 'School Debt',
    // Nelnet is the real servicer (one "l"), but both spellings appear in the
    // wild, so accept either.
    bills: ['nelnet - ella', 'nelnet - richard', 'nellnet - ella', 'nellnet - richard'],
  },  {
    title: 'Credit Cards',
    bills: [
      "ella's discover", "ella's old navy cc", "ella's apple card", "ella's pnc cash rewards",
      "ella's ally cc", "ella's avant cc", "ella's mission lane cc", "ella's indigo cc",
      "ella's destiny cc", "ella's prosper", "ella's navy federal", "rich amazon card",
      "rich's apple card", "mission lane", "rich's quicksilver cap1-9223", "rich's cap1 venture-6873",
      "rich's secure cap1-5491", "rich's plat2 cap1-5566", "rich's cap1 savor", "rich paypal credit",
      'pay pal credit', 'credit one amex', "rich's indigo", "rich's plat2 cap1-8259",
      "rich's quicksilver cap1-2266",
    ],
  },
  {
    title: 'Other Expenses',
    bills: [
      'midland - (aph law)', 'klarna k&g (my suit)', "klarna - sam's club (ethans monitor)",
      'klarna - walmart', 'klarna - stubhub', 'woodstock - law settlement',
    ],
  },
]

/** Normalize a payee name for fuzzy matching across bureaus and imports. */
export function normalizeBillName(name?: string): string {
  if (!name) return ''
  return String(name)
    .replace(/[\u2018\u2019\u201A\u00B4]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Does a payee name belong to a category entry?
 *
 * Categories store a short base name ("sorento fuel") while the real payee may
 * carry a suffix ("Sorento Fuel / Transportation"), so a prefix match in either
 * direction counts. This keeps categories from needing every variant spelled out.
 */
export function nameMatchesCategory(payee: string | undefined, categoryName: string): boolean {
  const p = normalizeBillName(payee)
  const c = normalizeBillName(categoryName)
  if (!p || !c) return false
  if (p === c) return true
  if (p.startsWith(c) || c.startsWith(p)) return true
  return false
}

export interface GroupableBill {
  id: number
  payee_name?: string
  amount: number
  due_date: string
}

/**
 * Bucket bills into the fixed category order. Anything that does not match a
 * known payee is collected so the caller can decide where it goes.
 */
export function groupBillsByCategory<T extends GroupableBill>(
  bills: T[]
): { groups: Array<{ title: string; items: T[] }>; unmatched: T[] } {
  // Keep only the earliest bill per payee, matching the Bills page behaviour.
  const byName = new Map<string, T>()
  for (const b of bills) {
    const key = normalizeBillName(b.payee_name)
    const prev = byName.get(key)
    if (!prev || b.id < prev.id) byName.set(key, b)
  }

  const used = new Set<number>()
  const groups: Array<{ title: string; items: T[] }> = []

  for (const cat of BILL_CATEGORIES) {
    const items: T[] = []
    for (const name of cat.bills) {
      const b = byName.get(name)
      if (b && !used.has(b.id)) {
        items.push(b)
        used.add(b.id)
      } else if (!b) {
        // Category entry with no exactly-matching bill: fall back to a prefix
        // match so suffixed payees like "Sorento Fuel / Transportation" land
        // in the right section.
        for (const [key, cand] of byName) {
          if (used.has(cand.id)) continue
          if (nameMatchesCategory(cand.payee_name, name)) {
            items.push(cand)
            used.add(cand.id)
            break
          }
        }
      }
    }
    items.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    groups.push({ title: cat.title, items })
  }

  const unmatched: T[] = []
  for (const b of bills) {
    if (!used.has(b.id)) {
      unmatched.push(b)
      used.add(b.id)
    }
  }
  unmatched.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))

  return { groups, unmatched }
}

/** Format a due date the way the Bills page does. */
export function formatBillDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr || '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Match a worksheet line item to a real bill so the due date can be shown.
 * Falls back to a loose contains-match for payees whose spelling drifted.
 */
export function matchBillForLabel<T extends GroupableBill>(
  label: string,
  bills: T[]
): T | null {
  const key = normalizeBillName(label)
  if (!key) return null
  const exact = bills.find(b => normalizeBillName(b.payee_name) === key)
  if (exact) return exact
  const partial = bills.find(b => {
    const bn = normalizeBillName(b.payee_name)
    return bn && key && (bn.includes(key) || key.includes(bn))
  })
  return partial || null
}
