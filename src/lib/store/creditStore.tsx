'use client'

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import type { Bureau, BureauReport, CreditData, GlobalSummary, MergedAccount, Account, AccountDiscrepancy } from '@/types'
import { parseFile } from '@/lib/parsers'
import { generateAIFindings } from '@/lib/utils/analysis'
import { generateDisputeItems } from '@/lib/utils/analysis'
import { useAuth } from '@/lib/auth-context'

const STORAGE_KEY = 'credit-dashboard-state'

interface CreditState {
  reports: BureauReport[]
  creditData: CreditData | null
  loading: boolean
  error: string | null
  isAnalyzing: boolean
}

type CreditAction =
  | { type: 'ADD_REPORT'; payload: BureauReport }
  | { type: 'REMOVE_REPORT'; payload: Bureau }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ANALYZING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ALL' }
  | { type: 'RECOMPUTE' }
  | { type: 'REPLACE_STATE'; payload: { reports: BureauReport[]; creditData: CreditData | null } }
  | { type: 'HYDRATE'; payload: { reports: BureauReport[] } }

const initialState: CreditState = {
  reports: [],
  creditData: null,
  loading: false,
  error: null,
  isAnalyzing: false,
}

function computeCreditData(reports: BureauReport[]): CreditData {
  const mergedAccounts = mergeAccounts(reports)
  const globalSummary = computeGlobalSummary(reports, mergedAccounts)
  const aiFindings = generateAIFindings(reports, mergedAccounts, globalSummary)
  const disputeItems = generateDisputeItems(reports, mergedAccounts)

  return {
    reports,
    mergedAccounts,
    globalSummary,
    aiFindings,
    disputeItems,
  }
}

function mergeAccounts(reports: BureauReport[]): MergedAccount[] {
  const mergedMap = new Map<string, { creditorName: string; accountType: string; accounts: Partial<Record<Bureau, Account>> }>()

  for (const report of reports) {
    for (const account of report.accounts) {
      const key = account.creditorName.toLowerCase().replace(/[^a-z0-9]/g, '')
      const existing = mergedMap.get(key)
      if (existing) {
        existing.accounts[report.bureau] = account
      } else {
        mergedMap.set(key, {
          creditorName: account.creditorName,
          accountType: account.accountType,
          accounts: { [report.bureau]: account },
        })
      }
    }
  }

  const results: MergedAccount[] = []
  for (const [key, value] of mergedMap) {
    const discrepancies: AccountDiscrepancy[] = []
    const bureaus = Object.keys(value.accounts) as Bureau[]
    const accountEntries = Object.entries(value.accounts) as [Bureau, Account][]

    if (accountEntries.length > 1) {
      const first = accountEntries[0][1]
      for (const [bureau, acc] of accountEntries.slice(1)) {
        if (first.balance !== acc.balance) {
          discrepancies.push({
            field: 'Balance',
            values: [
              { bureau: accountEntries[0][0], value: first.balance },
              { bureau, value: acc.balance },
            ],
          })
        }
        if (first.payStatus !== acc.payStatus) {
          discrepancies.push({
            field: 'Pay Status',
            values: [
              { bureau: accountEntries[0][0], value: first.payStatus },
              { bureau, value: acc.payStatus },
            ],
          })
        }
        if (first.dateOpened !== acc.dateOpened) {
          discrepancies.push({
            field: 'Date Opened',
            values: [
              { bureau: accountEntries[0][0], value: first.dateOpened },
              { bureau, value: acc.dateOpened },
            ],
          })
        }
      }
    }

    const bestStatus = accountEntries
      .map(([, a]) => a.status)
      .sort((a, b) => {
        const order: Record<string, number> = { Open: 0, Paid: 1, Closed: 2, Derogatory: 3, Collection: 4, ChargeOff: 5 }
        return (order[a] || 0) - (order[b] || 0)
      })[0]

    results.push({
      id: `merged-${key}`,
      creditorName: value.creditorName,
      accountType: value.accountType,
      accounts: value.accounts,
      discrepancies,
      isDisputed: false,
      disputeReasons: [],
      bestStatus,
      reportedOn: bureaus,
    })
  }

  return results
}

function computeGlobalSummary(reports: BureauReport[], _mergedAccounts: MergedAccount[]): GlobalSummary {
  let totalAccounts = 0, totalOpen = 0, totalClosed = 0
  let totalDerogatory = 0, totalChargeOffs = 0, totalCollections = 0
  let totalLateAccounts = 0, totalHardInquiries = 0, totalSoftInquiries = 0
  let totalPublicRecords = 0, totalBankruptcies = 0
  let totalBalance = 0, totalCreditLimit = 0

  for (const report of reports) {
    totalAccounts += report.summary.totalAccounts
    totalOpen += report.summary.openAccounts
    totalClosed += report.summary.closedAccounts
    totalDerogatory += report.summary.derogatoryAccounts
    totalChargeOffs += report.summary.chargeOffs
    totalCollections += report.summary.collections
    totalLateAccounts += report.summary.lateAccounts
    totalHardInquiries += report.summary.hardInquiries
    totalSoftInquiries += report.summary.softInquiries
    totalPublicRecords += report.summary.publicRecords
    totalBankruptcies += report.summary.bankruptcies
    totalBalance += report.summary.totalBalance
    totalCreditLimit += report.summary.totalCreditLimit
  }

  return {
    totalAccounts, totalOpen, totalClosed,
    totalDerogatory, totalChargeOffs, totalCollections,
    totalLateAccounts, totalHardInquiries, totalSoftInquiries,
    totalPublicRecords, totalBankruptcies,
    totalCreditUtilization: totalCreditLimit > 0 ? (totalBalance / totalCreditLimit) * 100 : 0,
    totalBalance, totalCreditLimit,
  }
}

function persistLocal(reports: BureauReport[]): void {
  if (typeof window === 'undefined') return
  try {
    const clean = reports.map(({ fileData, ...rest }) => rest)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ reports: clean }))
  } catch { /* ignore */ }
}

function loadLocal(): BureauReport[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return parsed.reports || []
    }
  } catch { /* ignore */ }
  return []
}

function reducer(state: CreditState, action: CreditAction): CreditState {
  let next: CreditState
  switch (action.type) {
    case 'ADD_REPORT': {
      const filtered = state.reports.filter(r => r.bureau !== action.payload.bureau)
      const reports = [...filtered, action.payload]
      next = { ...state, reports, creditData: computeCreditData(reports), error: null }
      break
    }
    case 'REMOVE_REPORT': {
      const reports = state.reports.filter(r => r.bureau !== action.payload)
      next = { ...state, reports, creditData: reports.length > 0 ? computeCreditData(reports) : null }
      break
    }
    case 'SET_LOADING': next = { ...state, loading: action.payload }; break
    case 'SET_ANALYZING': next = { ...state, isAnalyzing: action.payload }; break
    case 'SET_ERROR': next = { ...state, error: action.payload }; break
    case 'CLEAR_ALL': {
      if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY)
      next = initialState
      break
    }
    case 'RECOMPUTE': next = { ...state, creditData: state.reports.length > 0 ? computeCreditData(state.reports) : null }; break
    case 'REPLACE_STATE': {
      const reports = action.payload.reports
      next = { ...state, reports, creditData: reports.length > 0 ? computeCreditData(reports) : null }
      break
    }
    default: return state
  }
  return next
}

async function fetchServerReports(): Promise<BureauReport[]> {
  try {
    const res = await fetch('/api/reports')
    if (res.ok) {
      const data = await res.json()
      return data.reports || []
    }
  } catch { /* ignore */ }
  return []
}

async function saveReportToServer(report: BureauReport): Promise<void> {
  try {
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bureau: report.bureau, data: report }),
    })
  } catch { /* ignore */ }
}

async function deleteReportFromServer(bureau: Bureau): Promise<void> {
  try {
    await fetch(`/api/reports?bureau=${bureau}`, { method: 'DELETE' })
  } catch { /* ignore */ }
}

interface CreditContextType {
  state: CreditState
  initialized: boolean
  uploadFile: (file: File) => Promise<void>
  removeReport: (bureau: Bureau) => void
  clearAll: () => void
}

const CreditContext = createContext<CreditContextType | null>(null)

export function CreditProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [state, dispatch] = useReducer(reducer, initialState)
  const [initialized, setInitialized] = React.useState(false)

  // Hydrate on auth state change
  useEffect(() => {
    if (authLoading) return

    if (user) {
      fetchServerReports().then(reports => {
        dispatch({ type: 'REPLACE_STATE', payload: { reports, creditData: null } })
        setInitialized(true)
      })
    } else {
      dispatch({ type: 'CLEAR_ALL' })
      setInitialized(true)
    }
  }, [user, authLoading])

  // Persist to localStorage on every state change (non-logged-in cache)
  useEffect(() => {
    if (initialized && !user) {
      persistLocal(state.reports)
    }
  }, [state.reports, initialized, user])

  const uploadFile = useCallback(async (file: File) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      const result = await parseFile(file)
      if (!result.success || !result.data) {
        dispatch({ type: 'SET_ERROR', payload: result.error || 'Failed to parse file' })
        return
      }

      const fileName = file.name
      const data = { ...result.data, filename: fileName }

      if (data.accounts.length === 0) {
        dispatch({ type: 'SET_ERROR', payload: `Parsed ${result.bureau} report but found 0 accounts. The PDF may need text extraction improvements. Data imported with available information.` })
      }

      dispatch({ type: 'ADD_REPORT', payload: data })

      if (user) {
        await saveReportToServer(data)
        // Merge server reports with local state to preserve fileData if save failed
        const serverReports = await fetchServerReports()
        const merged = serverReports.map(sr => {
          const local = state.reports.find(r => r.bureau === sr.bureau)
          return local?.fileData ? { ...sr, fileData: local.fileData } : sr
        })
        dispatch({ type: 'REPLACE_STATE', payload: { reports: merged, creditData: null } })
      }
    } catch (e: unknown) {
      dispatch({ type: 'SET_ERROR', payload: e instanceof Error ? e.message : 'Upload failed' })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [user])

  const removeReport = useCallback((bureau: Bureau) => {
    dispatch({ type: 'REMOVE_REPORT', payload: bureau })
    if (user) {
      deleteReportFromServer(bureau)
    }
  }, [user])

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' })
    if (user) {
      const bureaus = state.reports.map(r => r.bureau)
      for (const b of bureaus) {
        deleteReportFromServer(b)
      }
    }
  }, [user, state.reports])

  return (
    <CreditContext.Provider value={{ state, initialized, uploadFile, removeReport, clearAll }}>
      {children}
    </CreditContext.Provider>
  )
}

export function useCredit() {
  const ctx = useContext(CreditContext)
  if (!ctx) throw new Error('useCredit must be used within CreditProvider')
  return ctx
}
