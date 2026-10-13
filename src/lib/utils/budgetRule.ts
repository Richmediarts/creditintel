export type Bucket = 'needs' | 'wants' | 'savings'

export interface BucketDef {
  key: Bucket
  title: string
  percent: number
  color: string
  barBg: string
  textColor: string
  ringColor: string
  description: string
  examples: string[]
}

export const BUCKETS: BucketDef[] = [
  {
    key: 'needs',
    title: 'Needs',
    percent: 50,
    color: 'blue',
    barBg: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
    ringColor: 'ring-blue-200 dark:ring-blue-900',
    description: 'The bills you cannot avoid. Housing, utilities, groceries, insurance, and minimum debt payments.',
    examples: ['Rent or mortgage', 'Electric / gas / water', 'Groceries', 'Car payment, gas, insurance', 'Phone and internet', 'Minimum credit card payments'],
  },
  {
    key: 'wants',
    title: 'Wants',
    percent: 20,
    color: 'amber',
    barBg: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    ringColor: 'ring-amber-200 dark:ring-amber-900',
    description: 'The things you choose. This is where most people have the most room to cut.',
    examples: ['Dining out', 'Streaming and subscriptions', 'Travel and vacations', 'Gym membership', 'Entertainment', 'Clothing beyond basics'],
  },
  {
    key: 'savings',
    title: 'Savings & Debt',
    percent: 30,
    color: 'emerald',
    barBg: 'bg-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    ringColor: 'ring-emerald-200 dark:ring-emerald-900',
    description: 'Your future self. Emergency fund, retirement, and paying down debt beyond the minimum.',
    examples: ['Emergency fund', 'Retirement or 401(k) beyond match', 'Extra debt payoff', 'Savings for a down payment', 'Investments'],
  },
]

export const BUCKET_MAP: Record<Bucket, BucketDef> = BUCKETS.reduce((acc, b) => {
  acc[b.key] = b
  return acc
}, {} as Record<Bucket, BucketDef>)

/**
 * Keyword rules for classifying a line item into a 50/30/20 bucket.
 * Order matters: savings is checked before needs so that "auto loan extra"
 * does not land in needs, and wants is checked before needs so that
 * "streaming" does not match "phone".
 */
const RULES: Array<{ bucket: Bucket; patterns: RegExp }> = [
  {
    bucket: 'savings',
    patterns:
      /\b(401k|403b|401\(k\)|retirement|roth|ira|pension|invest|brokerage|savings?|emergency fund|down payment|stock|401 match|employer match|hsa|fsa|college fund|529|pay ?off|extra (debt|payment|principal)|debt payoff)\b/i,
  },
  {
    bucket: 'wants',
    patterns:
      /\b(dining|restaurant|takeout|take out|coffee|starbucks|mcdonald|doordash|uber eats|grubhub|netflix|hulu|disney|spotify|hbo|max|prime video|youtube premium|apple music|subscriptions?|movies?|cinema|theaters?|theatres?|concerts?|gym|fitness|yoga|pilates|barber|haircut|nails?|beauty|makeup|clothing|apparel|shoes?|travel|vacation|hotels?|airbnb|airlines?|flights?|cruise|tickets?|events?|games?|steam|playstation|xbox|nintendo|hobby|crafts?|garden|gardening|lawn|landscap|pets?|zoo|toys?|gifts?|christmas|entertainment|fun|luxury|recreation)\b/i,
  },
  {
    bucket: 'needs',
    patterns:
      /\b(rent|mortgage|hoa|electric|power|gas (bill|company|utility)|water|sewer|septic|trash|waste|internet|wifi|comcast|xfinity|spectrum|phone|mobile|wireless|verizon|t-mobile|grocer|kroger|aldi|publix|food|lunch|breakfast|insurance|auto loan|car loan|car payment|vehicle|medicare|medicaid|health|dental|vision|prescription|doctor|childcare|daycare|school tuition|loan payment|minimum payments?|student loan|property tax|homeowner|renters)\b/i,
  },
]

/** Classify a label into a bucket. Defaults to `needs`. */
export function categorize(label: string): Bucket {
  const text = String(label || '').trim()
  if (!text) return 'needs'
  for (const rule of RULES) {
    if (rule.patterns.test(text)) return rule.bucket
  }
  return 'needs'
}

/** Starter line items shown in a fresh VOYA-style worksheet. */
export const TEMPLATE: Record<Bucket, string[]> = {
  needs: [
    'Rent or mortgage',
    'Electric',
    'Water / sewer',
    'Garbage pickup',
    'Homeowners insurance',
    'Groceries',
    'Gas / fuel',
    'Auto loan payment',
    'Auto insurance',
    'Phone',
    'Internet',
    'Minimum credit card payments',
  ],
  wants: [
    'Dining out',
    'Streaming subscriptions',
    'Clothing',
    'Haircut',
    'Gym',
    'Entertainment',
    'Travel',
  ],
  savings: [
    'Emergency fund',
    'Retirement contribution',
    'Extra debt payoff',
    'Savings for next car',
  ],
}

/** Compute the target dollar amount for a bucket from monthly income. */
export function bucketTarget(monthlyIncome: number, bucket: Bucket): number {
  return (Number(monthlyIncome) || 0) * (BUCKET_MAP[bucket].percent / 100)
}

export interface BucketStatus {
  key: Bucket
  target: number
  actual: number
  diff: number
  percentOfIncome: number
  overBy: boolean
  ratio: number
}

export function computeStatus(
  monthlyIncome: number,
  totals: Record<Bucket, number>
): BucketStatus[] {
  return BUCKETS.map(b => {
    const target = bucketTarget(monthlyIncome, b.key)
    const actual = totals[b.key] || 0
    return {
      key: b.key,
      target,
      actual,
      diff: target - actual,
      percentOfIncome: monthlyIncome > 0 ? (actual / monthlyIncome) * 100 : 0,
      overBy: actual > target + 0.005,
      ratio: target > 0 ? actual / target : 0,
    }
  })
}

/** A short verdict describing where the budget stands. */
export function budgetVerdict(
  monthlyIncome: number,
  totals: Record<Bucket, number>
): { tone: 'good' | 'warn' | 'bad'; title: string; detail: string } {
  const statuses = computeStatus(monthlyIncome, totals)
  const needs = statuses.find(s => s.key === 'needs')!
  const wants = statuses.find(s => s.key === 'wants')!
  const savings = statuses.find(s => s.key === 'savings')!

  if (monthlyIncome <= 0) {
    return { tone: 'warn', title: 'Enter your monthly income', detail: 'Add your take-home pay to see how your spending compares to the 50/30/20 targets.' }
  }

  if (needs.overBy) {
    return {
      tone: 'bad',
      title: 'Needs are over 50% of income',
      detail: `Your needs are ${needs.percentOfIncome.toFixed(0)}% of income. When needs exceed half, there is nothing left for savings. Cutting needs is the only lever that reliably moves this number.`,
    }
  }
  if (savings.actual / Math.max(savings.target, 1) >= 0.8) {
    return {
      tone: 'good',
      title: 'You are close to the 50/30/20 split',
      detail: `Needs ${needs.percentOfIncome.toFixed(0)}%, Wants ${wants.percentOfIncome.toFixed(0)}%, Savings and debt ${savings.percentOfIncome.toFixed(0)}%. Keep building the emergency fund and you will be in good shape.`,
    }
  }
  return {
    tone: 'warn',
    title: 'Savings are below target',
    detail: `Needs are within target at ${needs.percentOfIncome.toFixed(0)}%. Savings and debt payments are only ${savings.percentOfIncome.toFixed(0)}% of income. Redirecting part of your wants spending is the fastest fix.`,
  }
}
