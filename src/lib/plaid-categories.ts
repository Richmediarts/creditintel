const PRIMARY_LABELS: Record<string, string> = {
  TRANSFER_IN: 'Transfers In',
  TRANSFER_OUT: 'Transfers Out',
  LOAN_PAYMENTS: 'Loan Payments',
  BANK_FEES: 'Bank Fees',
  ENTERTAINMENT: 'Entertainment',
  FOOD_AND_DRINK: 'Food & Drink',
  GENERAL_MERCHANDISE: 'Shopping',
  HOME_IMPROVEMENT: 'Home Improvement',
  MEDICAL: 'Medical',
  PERSONAL_CARE: 'Personal Care',
  GENERAL_SERVICES: 'Services',
  GOVERNMENT_AND_NON_PROFIT: 'Government & Non-Profit',
  TRANSPORTATION: 'Transportation',
  TRAVEL: 'Travel',
  RENT_AND_UTILITIES: 'Rent & Utilities',
  INCOME: 'Income',
  OTHER: 'Other',
  EDUCATION: 'Education',
  CHARITY: 'Charity',
  BILL_PAYMENT: 'Bill Payments',
  UNCATEGORIZED: 'Uncategorized',
}

const CATEGORY_COLORS: Record<string, string> = {
  'Food & Drink': '#f59e0b',
  Transportation: '#3b82f6',
  Shopping: '#8b5cf6',
  Entertainment: '#ec4899',
  Travel: '#06b6d4',
  'Rent & Utilities': '#ef4444',
  Medical: '#14b8a6',
  'Services': '#f97316',
  'Bill Payments': '#64748b',
  'Loan Payments': '#eab308',
  Income: '#22c55e',
  Uncategorized: '#94a3b8',
}

const PALETTE = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#14b8a6', '#eab308']

export function prettyCategory(code: string | null | undefined): string {
  const key = (code || '').trim().toUpperCase()
  if (!key || key === 'UNCATEGORIZED') return 'Uncategorized'
  if (PRIMARY_LABELS[key]) return PRIMARY_LABELS[key]
  return key
    .toLowerCase()
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

export function categoryColor(label: string): string {
  return CATEGORY_COLORS[label] || PALETTE[label.length % PALETTE.length]
}

export const CATEGORY_PALETTE = PALETTE