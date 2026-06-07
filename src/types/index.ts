export type Bureau = 'Experian' | 'Equifax' | 'TransUnion'

export interface Account {
  id: string
  bureau: Bureau
  creditorName: string
  accountNumber: string
  accountType: 'Revolving' | 'Installment' | 'Mortgage' | 'Collection' | 'Student Loan' | 'Auto' | 'Other'
  loanType?: string
  dateOpened: string
  dateClosed?: string
  dateUpdated?: string
  balance: number
  pastDue?: number
  highBalance?: number
  creditLimit?: number
  monthlyPayment?: number
  payStatus: string
  responsibility?: string
  terms?: string
  remarks?: string
  paymentHistory: PaymentHistoryEntry[]
  isDerogatory: boolean
  isChargeOff: boolean
  isCollection: boolean
  isLate: boolean
  isOpen: boolean
  isClosed: boolean
  derogatoryCount: number
  estimatedRemovalDate?: string
  dateFirstDelinquency?: string
  originalCreditor?: string
  owner?: string
  status: 'Open' | 'Closed' | 'Paid' | 'ChargeOff' | 'Collection' | 'Derogatory'
}

export interface PaymentHistoryEntry {
  month: string
  year: string
  rating: string
  balance?: number
  pastDue?: number
  amountPaid?: number
  scheduledPayment?: number
}

export interface Inquiry {
  bureau: Bureau
  creditorName: string
  date: string
  type: 'Hard' | 'Soft'
  purpose?: string
}

export interface PublicRecord {
  bureau: Bureau
  type: string
  court?: string
  dateFiled: string
  dateResolved?: string
  amount?: number
  plaintiff?: string
  defendant?: string
  status: string
}

export interface PersonalInfo {
  name: string
  alsoKnownAs?: string[]
  ssn: string
  dateOfBirth: string
  currentAddress: string
  previousAddresses: string[]
  phoneNumbers: string[]
  employers: { name: string; occupation?: string; dateVerified?: string }[]
  fileNumber?: string
  reportDate: string
}

export interface BureauReport {
  bureau: Bureau
  personalInfo: PersonalInfo
  accounts: Account[]
  inquiries: Inquiry[]
  publicRecords: PublicRecord[]
  summary: BureauSummary
  rawText?: string
  filename?: string
}

export interface BureauSummary {
  totalAccounts: number
  openAccounts: number
  closedAccounts: number
  derogatoryAccounts: number
  chargeOffs: number
  collections: number
  lateAccounts: number
  hardInquiries: number
  softInquiries: number
  publicRecords: number
  bankruptcies: number
  totalBalance: number
  totalCreditLimit: number
  creditUtilization: number
  oldestAccountDate?: string
  newestAccountDate?: string
  averageAccountAge?: number
  totalMonthlyPayment?: number
}

export interface CreditData {
  reports: BureauReport[]
  mergedAccounts: MergedAccount[]
  globalSummary: GlobalSummary
  aiFindings: AIFinding[]
  disputeItems: DisputeItem[]
}

export interface MergedAccount {
  id: string
  creditorName: string
  accountType: string
  accounts: Partial<Record<Bureau, Account>>
  discrepancies: AccountDiscrepancy[]
  isDisputed: boolean
  disputeReasons: string[]
  bestStatus?: string
  reportedOn: Bureau[]
}

export interface AccountDiscrepancy {
  field: string
  values: { bureau: Bureau; value: string | number }[]
}

export interface GlobalSummary {
  totalAccounts: number
  totalOpen: number
  totalClosed: number
  totalDerogatory: number
  totalChargeOffs: number
  totalCollections: number
  totalLateAccounts: number
  totalHardInquiries: number
  totalSoftInquiries: number
  totalPublicRecords: number
  totalBankruptcies: number
  totalCreditUtilization: number
  totalBalance: number
  totalCreditLimit: number
}

export interface AIFinding {
  type: 'discrepancy' | 'eligible_dispute' | 'duplicate' | 'high_utilization' | 'early_exclusion' | 'score_improvement' | 'inconsistency'
  description: string
  severity: 'high' | 'medium' | 'low'
  accounts?: string[]
  bureaus?: Bureau[]
  estimatedScoreImpact?: number
}

export interface DisputeItem {
  accountId: string
  creditorName: string
  bureau: Bureau
  reasons: string[]
  inaccuracies: ('balance' | 'late_payment' | 'not_my_account' | 'duplicate' | 'obsolete' | 'identity_theft' | 'missing_payment' | 'fcra_violation')[]
  recommendedAction: string
  estimatedScoreGain?: number
}

export type DisputeStatus = 'not_filed' | 'filed' | 'in_dispute' | 'resolved' | 'closed'

export interface DisputeTracking {
  id: number
  userId: number
  creditorName: string
  bureau: Bureau
  inaccuracies: string[]
  status: DisputeStatus
  filedDate: string | null
  expectedResponseDate: string | null
  resolvedDate: string | null
  notes: string
  createdAt: string
  updatedAt: string
  isOverdue: boolean
  daysUntilResponse: number | null
}

export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'member'
  createdAt: string
}

export interface FicoScoreEntry {
  score: number | null
  dateUpdated: string | null
}

export type FicoScores = Partial<Record<Bureau, FicoScoreEntry>>
