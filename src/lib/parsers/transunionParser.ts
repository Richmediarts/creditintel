import type { Bureau, Account, Inquiry, PublicRecord, PersonalInfo, BureauReport, BureauSummary, PaymentHistoryEntry } from '@/types'

export function parseTransUnion(text: string): Omit<BureauReport, 'filename'> {
  const lines = text.split('\n')

  const personalInfo = extractPersonalInfo(lines)
  const accounts = extractAccounts(lines)
  const inquiries = extractInquiries(lines)
  const publicRecords = extractPublicRecords(lines)
  const summary = computeSummary(accounts, inquiries, publicRecords)

  return {
    bureau: 'TransUnion' as Bureau,
    personalInfo,
    accounts,
    inquiries,
    publicRecords,
    summary,
    rawText: text,
  }
}

function extractPersonalInfo(lines: string[]): PersonalInfo {
  const info: PersonalInfo = {
    name: '',
    ssn: '',
    dateOfBirth: '',
    currentAddress: '',
    previousAddresses: [],
    phoneNumbers: [],
    employers: [],
    reportDate: '',
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()

    if (line.includes('Personal Credit Report for')) {
      const next = lines[i + 1]?.trim() || ''
      info.name = next
    }

    if (line.includes('File Number:')) {
      info.fileNumber = line.split('File Number:')[1]?.trim()
    }

    if (line.includes('Date Created:')) {
      info.reportDate = line.split('Date Created:')[1]?.trim()
    }

    if (line.includes('SSN has been masked') || line.includes('Social Security Number')) {
      const ssnLine = lines[i + 3]?.trim() || ''
      info.ssn = ssnLine
    }

    if (line.includes('Date of Birth')) {
      info.dateOfBirth = lines[i + 3]?.trim() || ''
    }

    if (line.includes('Name') && info.name === '') {
      const nameLine = lines[i + 3]?.trim() || ''
      if (nameLine && !nameLine.includes('Also Known As') && !nameLine.includes('AKA')) {
        info.name = nameLine
      }
    }

    if (line.includes('Also Known As') || line.includes('AKA')) {
      const akaLine = lines[i + 3]?.trim() || ''
      if (akaLine && !akaLine.includes('Also Known As')) {
        info.alsoKnownAs = [akaLine]
      }
    }

    if (line === 'Current Address') {
      info.currentAddress = lines[i + 3]?.trim() || ''
    }

    if (line === 'Other Address') {
      const addr = lines[i + 3]?.trim() || ''
      if (addr) info.previousAddresses.push(addr)
    }

    if (line.startsWith('Phone Number')) {
      const phone = lines[i + 3]?.trim() || ''
      if (phone) info.phoneNumbers.push(phone)
    }

    if (line === 'Employer' || line.match(/^[A-Z][A-Z\s]+$/)) {
      const employerName = line
      const occLine = lines[i + 3]?.trim() || ''
      const verifiedLine = lines[i + 5]?.trim() || ''
      if (employerName && !['Phone Number', 'Occupation', 'Location', 'Date Verified', 'Address', 'Account Information', 'Account Name', 'Accounts with Adverse Information', 'Personal Information', 'Phone Numbers', 'Employers', 'Addresses'].includes(employerName)) {
        info.employers.push({
          name: employerName,
          occupation: occLine || undefined,
          dateVerified: verifiedLine || undefined,
        })
      }
    }

    i++
  }

  return info
}

function extractAccounts(lines: string[]): Account[] {
  const accountInfoIndices: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'Account Information') {
      accountInfoIndices.push(i)
    }
  }

  const accounts: Account[] = []

  for (let a = 0; a < accountInfoIndices.length; a++) {
    const infoIdx = accountInfoIndices[a]
    const nextInfoIdx = a + 1 < accountInfoIndices.length ? accountInfoIndices[a + 1] : lines.length

    const { creditorName, accountNumber } = extractCreditorInfo(lines, infoIdx)
    const chunk = lines.slice(infoIdx, nextInfoIdx)
    const account = parseAccountChunk(chunk)
    if (!account) continue

    account.creditorName = creditorName
    account.accountNumber = accountNumber || account.accountNumber || ''

    accounts.push(finalizeAccount(account))
  }

  return accounts
}

function extractCreditorInfo(lines: string[], accountInfoIdx: number): { creditorName: string; accountNumber: string } {
  const parts: string[] = []
  let i = accountInfoIdx - 1

  while (i >= 0) {
    const line = lines[i].trim()
    if (line === '') {
      i--
      continue
    }
    if (line === 'Account Name' || line.startsWith('Total Months')) {
      break
    }
    parts.unshift(line)
    i--
  }

  let accountNumber = ''
  const nameParts = [...parts]

  if (nameParts.length > 0) {
    const last = nameParts[nameParts.length - 1]

    if (/^[A-Za-z0-9]+\*{3,4}$/.test(last)) {
      accountNumber = last
      nameParts.pop()
    } else {
      const m = last.match(/^(.+)\s+([A-Za-z0-9]+\*{3,4})$/)
      if (m) {
        nameParts[nameParts.length - 1] = m[1].trim()
        accountNumber = m[2]
      }
    }
  }

  const creditorName = nameParts.join(' ').trim() || 'Unknown'
  return { creditorName, accountNumber }
}

const FIELD_HEADERS = new Set([
  'Address',
  'Phone',
  'Date Opened',
  'Responsibility',
  'Account Type',
  'Loan Type',
  'Balance',
  'Date Updated',
  'Payment Received',
  'Last Payment Made',
  'Pay Status',
  'Terms',
  'Date Closed',
  'Remarks',
  'Payment History',
  'Account Information',
])

function isFieldHeader(line: string): boolean {
  if (FIELD_HEADERS.has(line)) return true
  if (line.startsWith('Monthly Payment')) return true
  if (line.startsWith('High Balance')) return true
  if (line.startsWith('Credit Limit')) return true
  if (line.startsWith('Estimated')) return true
  return false
}

function readFieldValue(lines: string[], fieldIdx: number): string {
  let i = fieldIdx + 1
  while (i < lines.length && lines[i].trim() === '') {
    i++
  }
  if (i >= lines.length) return ''

  const firstLine = lines[i].trim()
  if (firstLine === '' || isFieldHeader(firstLine)) {
    return ''
  }

  const valueLines: string[] = []
  while (i < lines.length) {
    const line = lines[i].trim()
    if (line === '' || isFieldHeader(line)) {
      break
    }
    valueLines.push(line)
    i++
  }

  return valueLines.join(' ')
}

function parseAccountChunk(lines: string[]): Partial<Account> | null {
  const acc: Partial<Account> = {}
  let inPaymentHistory = false
  const pendingMonths: Array<{ month: string; year: string }> = []
  const paymentHistory: PaymentHistoryEntry[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line === 'Account Information') continue
    if (line === '' && !inPaymentHistory) continue

    if (line === 'Payment History') {
      inPaymentHistory = true
      continue
    }

    if (inPaymentHistory) {
      const monthRegex = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/g
      let m
      let foundMonth = false
      while ((m = monthRegex.exec(line)) !== null) {
        pendingMonths.push({ month: m[1], year: m[2] })
        foundMonth = true
      }
      if (foundMonth) continue

      if (line === 'Rating') {
        const ratingValue = readFieldValue(lines, i)
        if (ratingValue && pendingMonths.length > 0) {
          const monthInfo = pendingMonths.shift()!
          paymentHistory.push({
            month: monthInfo.month,
            year: monthInfo.year,
            rating: ratingValue,
          })
        }
        continue
      }

      continue
    }

    if (line.startsWith('Monthly Payment')) {
      const val = readFieldValue(lines, i)
      if (val) {
        const vm = val.match(/\$[\d,]+/)
        if (vm) acc.monthlyPayment = parseAmount(vm[0])
      }
    } else if (line === 'Date Opened') {
      acc.dateOpened = readFieldValue(lines, i)
    } else if (line === 'Responsibility') {
      acc.responsibility = readFieldValue(lines, i)
    } else if (line === 'Account Type') {
      const val = readFieldValue(lines, i).toLowerCase()
      if (val.includes('revolving')) acc.accountType = 'Revolving'
      else if (val.includes('installment')) acc.accountType = 'Installment'
      else if (val.includes('mortgage')) acc.accountType = 'Mortgage'
      else if (val.includes('collection')) acc.accountType = 'Collection'
      else if (val.includes('student')) acc.accountType = 'Student Loan'
      else if (val.includes('auto')) acc.accountType = 'Auto'
      else acc.accountType = 'Other'
    } else if (line === 'Loan Type') {
      acc.loanType = readFieldValue(lines, i)
    } else if (line === 'Balance') {
      const val = readFieldValue(lines, i)
      if (val) {
        const vm = val.match(/\$[\d,]+/)
        if (vm) {
          acc.balance = parseAmount(vm[0])
        } else {
          const num = parseFloat(val.replace(/[^0-9.-]/g, ''))
          if (!isNaN(num)) acc.balance = num
        }
      }
    } else if (line === 'Date Updated') {
      acc.dateUpdated = readFieldValue(lines, i)
    } else if (line.startsWith('Last Payment Made')) {
      // skip, not stored
    } else if (line.startsWith('High Balance')) {
      const val = readFieldValue(lines, i)
      if (val) {
        const vm = val.match(/\$[\d,]+/)
        if (vm) acc.highBalance = parseAmount(vm[0])
      }
    } else if (line === 'Pay Status') {
      let val = readFieldValue(lines, i)
      val = val.replace(/[<>]/g, '')
      acc.payStatus = val
    } else if (line.startsWith('Terms')) {
      acc.terms = readFieldValue(lines, i)
    } else if (line === 'Date Closed') {
      acc.dateClosed = readFieldValue(lines, i)
    } else if (line.startsWith('Credit Limit')) {
      const val = readFieldValue(lines, i)
      if (val) {
        const vm = val.match(/\$[\d,]+/)
        if (vm) acc.creditLimit = parseAmount(vm[0])
      }
    } else if (line.startsWith('Estimated')) {
      let nextIdx = i + 1
      while (nextIdx < lines.length && lines[nextIdx].trim() === '') {
        nextIdx++
      }
      if (nextIdx < lines.length && lines[nextIdx].trim() === 'removed') {
        acc.estimatedRemovalDate = readFieldValue(lines, nextIdx)
      } else {
        acc.estimatedRemovalDate = readFieldValue(lines, i)
      }
    } else if (line === 'Remarks') {
      acc.remarks = readFieldValue(lines, i)
    }
  }

  if (paymentHistory.length > 0) {
    acc.paymentHistory = paymentHistory
  }

  return acc
}

function extractInquiries(_: string[]): Inquiry[] {
  return []
}

function extractPublicRecords(_: string[]): PublicRecord[] {
  return []
}

function finalizeAccount(acc: Partial<Account>): Account {
  const payStatus = (acc.payStatus || '').toLowerCase()
  const remarks = (acc.remarks || '').toLowerCase()

  const hasDerogatoryPayStatus =
    payStatus.includes('charge') ||
    payStatus.includes('collection') ||
    payStatus.includes('late') ||
    payStatus.includes('delinquent') ||
    payStatus.includes('bad debt') ||
    payStatus.includes('past due')

  const isDerogatory = acc.isDerogatory ||
    hasDerogatoryPayStatus ||
    remarks.includes('settled') ||
    remarks.includes('charge off') ||
    remarks.includes('collection')

  const isChargeOff = acc.isChargeOff ||
    payStatus.includes('charge off') ||
    payStatus.includes('charge-off') ||
    payStatus.includes('charged off') ||
    payStatus.startsWith('charge') ||
    remarks.includes('charge off')

  const isCollection = acc.isCollection ||
    payStatus.includes('collection') ||
    remarks.includes('collection')

  const isLate = acc.isLate ||
    hasDerogatoryPayStatus ||
    (acc.paymentHistory || []).some(ph => ph.rating !== 'OK' && ph.rating !== '' && ph.rating !== 'N/R')

  const isClosed = acc.isClosed ||
    payStatus.includes('closed') ||
    payStatus.includes('paid') ||
    payStatus.startsWith('paid,')

  const isOpen = acc.isOpen ||
    (!isClosed && !isChargeOff && !isCollection)

  let status: Account['status'] = 'Open'
  if (isChargeOff) status = 'ChargeOff'
  else if (isCollection) status = 'Collection'
  else if (isDerogatory) status = 'Derogatory'
  else if (isClosed) status = 'Closed'
  else if (payStatus.includes('paid')) status = 'Paid'

  return {
    id: `tu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    bureau: 'TransUnion' as Bureau,
    creditorName: acc.creditorName || 'Unknown',
    accountNumber: acc.accountNumber || '',
    accountType: (acc.accountType as Account['accountType']) || 'Other',
    loanType: acc.loanType,
    dateOpened: acc.dateOpened || '',
    dateClosed: acc.dateClosed,
    dateUpdated: acc.dateUpdated,
    balance: acc.balance || 0,
    highBalance: acc.highBalance,
    creditLimit: acc.creditLimit,
    monthlyPayment: acc.monthlyPayment,
    payStatus: acc.payStatus || '',
    responsibility: acc.responsibility,
    terms: acc.terms,
    remarks: acc.remarks,
    paymentHistory: acc.paymentHistory || [],
    isDerogatory,
    isChargeOff,
    isCollection,
    isLate,
    isOpen,
    isClosed,
    derogatoryCount: (acc.paymentHistory || []).filter(ph => ph.rating !== 'OK' && ph.rating !== '' && ph.rating !== 'N/R').length,
    estimatedRemovalDate: acc.estimatedRemovalDate,
    status,
  }
}

function computeSummary(accounts: Account[], inquiries: Inquiry[], publicRecords: PublicRecord[]): BureauSummary {
  const totalAccounts = accounts.length
  const openAccounts = accounts.filter(a => a.isOpen).length
  const closedAccounts = accounts.filter(a => a.isClosed).length
  const derogatoryAccounts = accounts.filter(a => a.isDerogatory).length
  const chargeOffs = accounts.filter(a => a.isChargeOff).length
  const collections = accounts.filter(a => a.isCollection).length
  const lateAccounts = accounts.filter(a => a.isLate).length
  const hardInquiries = inquiries.filter(i => i.type === 'Hard').length
  const softInquiries = inquiries.filter(i => i.type === 'Soft').length
  const bankruptcies = publicRecords.filter(pr => pr.type.toLowerCase().includes('bankrupt')).length
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  // Credit utilization: only revolving accounts with credit limits
  const revolvingAccounts = accounts.filter(a => a.accountType === 'Revolving' && (a.creditLimit || 0) > 0)
  const revBalances = revolvingAccounts.reduce((s, a) => s + a.balance, 0)
  const revLimits = revolvingAccounts.reduce((s, a) => s + (a.creditLimit || 0), 0)
  const creditUtilization = revLimits > 0 ? (revBalances / revLimits) * 100 : 0
  const totalCreditLimit = revLimits

  return {
    totalAccounts,
    openAccounts,
    closedAccounts,
    derogatoryAccounts,
    chargeOffs,
    collections,
    lateAccounts,
    hardInquiries,
    softInquiries,
    publicRecords: publicRecords.length,
    bankruptcies,
    totalBalance,
    totalCreditLimit,
    creditUtilization,
  }
}

function parseAmount(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/[^0-9.-]/g, '')) || 0
}
