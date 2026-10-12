import type { Bureau } from '@/types'

export interface DtiScenario {
  id: string
  label: string
  detail: string
  /** Rough months to achieve at the given monthly payment. */
  months: number
  impact: 'high' | 'medium' | 'low'
}

export interface DtiLever {
  id: string
  title: string
  category: 'Pay down debt' | 'Raise income' | 'Reduce the loan' | 'Fix your file' | 'Timing'
  summary: string
  steps: string[]
  /** Months of lead time before a mortgage application. */
  leadTimeMonths: number
  dtiImpact: 'high' | 'medium' | 'low'
  /** True when the lever reduces the monthly payment instead of the numerator. */
  reducesPayment?: boolean
}

export const DTI_LEVERS: DtiLever[] = [
  {
    id: 'payoff-cards',
    title: 'Pay off credit cards before applying',
    category: 'Pay down debt',
    summary: 'The single fastest way to cut DTI. Revolving balances are counted at the balance, not the minimum payment.',
    steps: [
      'Order balances by interest rate, highest first (not smallest balance).',
      'Direct every extra dollar at the top card until it hits zero.',
      'Call each issuer and ask for a "payoff good date" letter showing a $0 balance.',
      'Lenders pull a fresh credit report and will exclude a card at a $0 balance from DTI.',
    ],
    leadTimeMonths: 6,
    dtiImpact: 'high',
  },
  {
    id: 'auto-payoff',
    title: 'Pay off or restructure auto and student loans',
    category: 'Pay down debt',
    summary: 'Installment balances count at the monthly payment. Retiring the loan removes it entirely.',
    steps: [
      'Get a payoff quote for each auto loan — settlement amounts often include a payoff-date waiver.',
      'Dealer or lender refinancing can cut a 72-month loan to 48 months at a lower rate, which lowers the monthly payment.',
      'For federal student loans, an income-driven repayment plan can cut the payment, but verify it is reported correctly to the bureaus.',
    ],
    leadTimeMonths: 6,
    dtiImpact: 'high',
  },
  {
    id: 'verify-report',
    title: 'Remove balances the bureaus do not know about',
    category: 'Fix your file',
    summary: 'If a debt is on your credit report but you have already paid it, it still raises your DTI.',
    steps: [
      'Compare your three reports against your own records line by line.',
      'Dispute any installment account still showing a balance after you paid it off.',
      'Mortgage lenders pull all three reports, so a $0 payoff must be reported as $0 on all of them.',
    ],
    leadTimeMonths: 3,
    dtiImpact: 'high',
  },
  {
    id: 'boost-income',
    title: 'Add documented income before applying',
    category: 'Raise income',
    summary: 'Gross income is what counts, not what hits the bank account. Any documented, recurring income helps.',
    steps: [
      '1099 / contract work is counted by most lenders for self-employment income.',
      'Overtime, shift differentials, and bonuses count if they recur — keep two years of W-2s or pay stubs.',
      'GA has no state income tax, so your gross-to-net ratio is more favorable than most states.',
      'Rental income from a legal ADU or rented room can be counted, but many lenders require 12 months of history.',
    ],
    leadTimeMonths: 2,
    dtiImpact: 'high',
  },
  {
    id: 'co-borrower',
    title: 'Consider a co-borrower or co-signer',
    category: 'Raise income',
    summary: 'Both incomes are combined for the qualifying DTI. Plan for the hard inquiry on their file too.',
    steps: [
      'A co-borrower shares legal liability and occupies the home — usually the better option.',
      'A co-signer stays off the title and lease but still has full credit liability.',
      'Their DTI becomes part of the loan, so check their file first.',
    ],
    leadTimeMonths: 3,
    dtiImpact: 'high',
  },
  {
    id: 'larger-down',
    title: 'Increase the down payment to reach 20%',
    category: 'Reduce the loan',
    summary: 'Removing PMI can free up roughly 0.5% of the loan per year — often enough to pass a DTI cutoff.',
    steps: [
      'Under 20% down, PMI typically costs 0.25%–0.75% of the loan amount annually.',
      'On a $300,000 loan at 0.55%, PMI is about $138/month.',
      'If you are within a few thousand dollars of 20%, a small extra down payment can drop the payment enough to change the DTI outcome.',
    ],
    leadTimeMonths: 1,
    dtiImpact: 'medium',
    reducesPayment: true,
  },
  {
    id: 'longer-term',
    title: 'Use the full 30-year term',
    category: 'Reduce the loan',
    summary: 'A 30-year amortization lowers the principal and interest portion compared with 15-year terms.',
    steps: [
      'Never choose a 15-year term to look stronger — it raises your payment and therefore your DTI.',
      'You can always make extra principal payments later; you cannot un-lock a 15-year term.',
    ],
    leadTimeMonths: 0,
    dtiImpact: 'medium',
    reducesPayment: true,
  },
  {
    id: 'less-expensive',
    title: 'Buy below your max price',
    category: 'Reduce the loan',
    summary: 'Target a 20–23% down payment and a payment you could cover on one income if you lost a job.',
    steps: [
      'Add 3% of the purchase price for Georgia closing costs when sizing your budget.',
      'Keep reserves of 2–3 months of payments plus your emergency fund intact after closing.',
      'Negotiate and request seller concessions on closing costs, which preserve cash for reserves.',
    ],
    leadTimeMonths: 0,
    dtiImpact: 'low',
    reducesPayment: true,
  },
  {
    id: 'pause-apply',
    title: 'Freeze applications 6 months before you apply',
    category: 'Timing',
    summary: 'Mortgage inquiries are pulled as a hard inquiry within 45 days of your rate lock, so pre-shopping is mostly harmless.',
    steps: [
      'Rate-shopping within a 14–45 day window counts as a single hard inquiry.',
      'Do not open, close, or max out any card, or finance furniture or a car.',
      'Keep utilization under 30% and ideally under 10% on the card used for the deposit.',
    ],
    leadTimeMonths: 6,
    dtiImpact: 'low',
  },
  {
    id: 'keep-cards-open',
    title: 'Keep existing credit cards open',
    category: 'Timing',
    summary: 'Closing cards after closing the home can raise your utilization and hurt your score right after closing.',
    steps: [
      'Keep the oldest card open with a zero balance.',
      'Close or reduce newer cards instead if you need to free monthly payment budget.',
    ],
    leadTimeMonths: 0,
    dtiImpact: 'low',
  },
]

export interface AssistanceProgram {
  name: string
  url: string
  provider: string
  type: 'Federal' | 'State' | 'Nonprofit' | 'Local'
  /** Typical assistance described by the program. */
  assistance: string
  bestFor: string
  notes: string
}

export const ASSISTANCE_PROGRAMS: AssistanceProgram[] = [
  {
    name: 'Georgia Housing Finance Authority — Home Choice Mortgage',
    url: 'https://ghfa.com/',
    provider: 'Georgia Housing Finance Authority',
    type: 'State',
    assistance: 'Up to $2,000 forgivable second lien',
    bestFor: 'First-time Georgia buyers',
    notes: 'Requires completion of an approved homebuyer education course and use of a participating lender. The second lien is forgiven after sustained occupancy.',
  },
  {
    name: 'Georgia Housing Finance Authority — Homeownership Assistance Program',
    url: 'https://ghfa.com/homeownership/home-choice-mortgage-program/',
    provider: 'Georgia Housing Finance Authority',
    type: 'State',
    assistance: 'Down payment and closing cost assistance',
    bestFor: 'Moderate and middle income Georgia households',
    notes: 'Income limits apply. Assistance is typically structured as a forgivable second lien tied to continued occupancy.',
  },
  {
    name: 'Fannie Mae HomeStyle Mortgage',
    url: 'https://fanniemae.com/homestyle',
    provider: 'Fannie Mae',
    type: 'Federal',
    assistance: '3% down with no PMI',
    bestFor: 'Buyers with a thin credit file',
    notes: 'Allows credit scores down to 620 and permits rent history, on-time utility and phone payments as a substitute for a thin file.',
  },
  {
    name: 'Fannie Mae HomeReady',
    url: 'https://fanniemae.com/homeready',
    provider: 'Fannie Mae',
    type: 'Federal',
    assistance: '3% down plus cancellable mortgage insurance',
    bestFor: 'Buyers who need lower monthly payments',
    notes: 'Community-based HomeReady mortgage insurance can reduce or cancel the monthly mortgage insurance premium.',
  },
  {
    name: 'Freddie Mac Home Possible Advantage',
    url: 'https://sf.freddiemac.com/products/home-possible-mortgage',
    provider: 'Freddie Mac',
    type: 'Federal',
    assistance: 'Up to 5% down assistance, no income limit',
    bestFor: 'First-time and moderate income buyers',
    notes: 'One of the broadest programs: no minimum income, no first-time-buyer restriction, and no maximum income limit.',
  },
  {
    name: 'USDA Single Family Housing Direct Home Loan',
    url: 'https://www.rd.usda.gov/programs-and-services/single-family-housing-programs/single-family-housing-direct-home-loans',
    provider: 'USDA Rural Development',
    type: 'Federal',
    assistance: '0% down, no PMI',
    bestFor: 'Rural and small-town properties',
    notes: 'No down payment and no mortgage insurance. There is no explicit income cap, but repayments are income-based and capped at 38% of adjusted income.',
  },
  {
    name: 'VA Loan',
    url: 'https://www.va.gov/housing-assistance/home-loans/',
    provider: 'U.S. Department of Veterans Affairs',
    type: 'Federal',
    assistance: '0% down, no PMI',
    bestFor: 'Eligible service members, veterans, and surviving spouses',
    notes: 'Also includes funding and counseling fees and a funding fee that can be deferred. VA is lenient on credit history after seasoning.',
  },
  {
    name: 'HUD FHA Loan',
    url: 'https://www.hud.gov/program_offices/housing',
    provider: 'HUD',
    type: 'Federal',
    assistance: 'As low as 3.5% down',
    bestFor: 'Buyers with 580+ credit score and lower reserves',
    notes: 'Minimum credit score varies by down payment. Can be stacked with a down payment assistance program.',
  },
  {
    name: 'Good Samaritan Network',
    url: 'https://app.gosamnetwork.org/',
    provider: 'Good Samaritan Network',
    type: 'Nonprofit',
    assistance: 'Down payment and closing costs',
    bestFor: 'Applicants needing assistance in participating Georgia counties',
    notes: 'Partners with local approved lenders. Assistance is forgivable after a service period. Participation is limited to specific counties.',
  },
  {
    name: 'Manna Foundation',
    url: 'https://mannafoundation.org/',
    provider: 'Manna Foundation',
    type: 'Nonprofit',
    assistance: 'Forgivable down payment assistance',
    bestFor: 'Metro Atlanta area buyers with financial hardship',
    notes: 'Grants are forgivable via a shared-appreciation second lien after the home is sold or refinanced with cash out.',
  },
  {
    name: 'Habitat for Humanity ReStore / Homeownership',
    url: 'https://www.habitat.org/',
    provider: 'Habitat for Humanity affiliates',
    type: 'Nonprofit',
    assistance: 'Below-market purchase with forgivable mortgage',
    bestFor: 'Buyers who qualify for Habitat income and volunteer requirements',
    notes: 'Affiliates operate county by county with their own income limits and volunteer hour requirements.',
  },
  {
    name: 'HUD-Approved Housing Counselor Search',
    url: 'https://www.hud.gov/i_want_to/talk_to_a_housing_counselor',
    provider: 'HUD',
    type: 'Federal',
    assistance: 'Free or low-cost counseling, and lender referrals',
    bestFor: 'Anyone who needs a realistic affordability analysis',
    notes: 'Many DAP programs require a certificate of completion from a HUD-approved counselor. This search locates counselors by state and county.',
  },
]

export interface CounselingAndFreeOptions {
  title: string
  url: string
  description: string
}

export const FREE_STEPS: CounselingAndFreeOptions[] = [
  {
    title: 'Free FICO 8 scores',
    url: 'https://www.experian.com/products/credit-monitoring/',
    description: 'Experian free account shows your FICO 8 and a free report. myFICO gives your Equifax FICO 8 at no cost.',
  },
  {
    title: 'Free mortgage-specific scores',
    url: 'https://www.myfico.com/',
    description: 'Mortgage lenders use FICO 2 (Experian), FICO 5 (Equifax), and FICO 4 (TransUnion). myFICO requires a subscription for these three.',
  },
  {
    title: 'Georgia probate and homestead filing check',
    url: 'https://qpublic.schneidercorp.com/GA/Cobb/index.html',
    description: 'Confirm there is no recorded title issue or mechanic lien on a specific address before offering.',
  },
]

/**
 * Estimate how much DTI drops if a monthly payment is added to debt payoff.
 * DTI is expressed as a percentage of gross monthly income.
 */
export function dtiAfterPayoff(
  currentMonthlyDebts: number,
  monthlyIncome: number,
  extraMonthlyPayment: number
): number {
  if (monthlyIncome <= 0) return 0
  return ((currentMonthlyDebts - extraMonthlyPayment) / monthlyIncome) * 100
}

/** Extra monthly payment needed to reach a target DTI. */
export function paymentToReachDti(
  currentMonthlyDebts: number,
  monthlyIncome: number,
  targetDti: number
): number {
  if (monthlyIncome <= 0) return 0
  const targetDebt = (targetDti / 100) * monthlyIncome
  return Math.max(0, currentMonthlyDebts - targetDebt)
}

export const DTI_BUREAU_TARGETS: Record<Bureau, number> = {
  Experian: 2,
  Equifax: 5,
  TransUnion: 4,
}
