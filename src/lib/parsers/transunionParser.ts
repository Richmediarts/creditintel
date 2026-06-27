import type { Bureau, Account, Inquiry, PublicRecord, PersonalInfo, BureauReport, BureauSummary } from '@/types'

export function parseTransUnion(text: string): Omit<BureauReport, 'filename'> {
  const lines = text.split('\n')

  const personalInfo = extractPersonalInfo(lines)
  let accounts = extractAccounts(lines)
  if (accounts.length === 0) accounts = extractAccountsRegex(text)
  const inquiries = extractInquiries(lines, text)
  const publicRecords: PublicRecord[] = []
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
    name: '', ssn: '', dateOfBirth: '', currentAddress: '',
    previousAddresses: [], phoneNumbers: [], employers: [], reportDate: '',
  }

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()

    if (t.includes('Personal Credit Report for')) {
      const next = lines[i + 1]?.trim() || ''
      if (next && !next.includes('Your credit score')) info.name = next
    }

    if (t.includes('File Number:')) {
      info.fileNumber = t.split('File Number:')[1]?.trim()
    }

    if (t.includes('Date Created:')) {
      info.reportDate = t.split('Date Created:')[1]?.trim()
    }

    if (t.includes('Social Security Number') || t.includes('SSN has been masked')) {
      const ssnLine = lines[i + 3]?.trim() || ''
      if (ssnLine && !ssnLine.includes('Date of Birth')) info.ssn = ssnLine
    }

    if (t.includes('Date of Birth')) {
      const dob = lines[i + 3]?.trim() || ''
      if (dob) info.dateOfBirth = dob
    }

    if (t === 'Current Address') {
      const addr = lines[i + 3]?.trim() || ''
      if (addr) info.currentAddress = addr
    }

    if (t === 'Other Address') {
      const addr = lines[i + 3]?.trim() || ''
      if (addr) info.previousAddresses.push(addr)
    }

    if (t.startsWith('Phone Number')) {
      const phone = lines[i + 3]?.trim() || ''
      if (phone && phone.match(/\(\d{3}\)/)) info.phoneNumbers.push(phone)
    }

    if (t === 'Employer' || t.match(/^[A-Z][A-Z\s]+$/) && t.length > 3) {
      const skip = ['Phone Number', 'Occupation', 'Location', 'Date Verified', 'Address',
        'Account Information', 'Account Name', 'Accounts with Adverse Information',
        'Personal Information', 'Phone Numbers', 'Employers', 'Addresses', 'Satisfactory Accounts']
      if (skip.includes(t)) continue
      const occ = lines[i + 3]?.trim() || ''
      const verified = lines[i + 5]?.trim() || ''
      info.employers.push({ name: t, occupation: occ || undefined, dateVerified: verified || undefined })
    }
  }

  return info
}

function extractAccounts(lines: string[]): Account[] {
  const accounts: Account[] = []
  const accountInfoIndices: number[] = []

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'Account Information') {
      accountInfoIndices.push(i)
    }
  }

  for (let a = 0; a < accountInfoIndices.length; a++) {
    const infoIdx = accountInfoIndices[a]
    const nextInfoIdx = a + 1 < accountInfoIndices.length ? accountInfoIndices[a + 1] : lines.length

    const { creditorName, accountNumber } = extractCreditorInfo(lines, infoIdx)
    if (!creditorName) continue

    const chunk = lines.slice(infoIdx, nextInfoIdx)
    const acc = parseAccountChunk(chunk)
    if (!acc) continue

    acc.creditorName = creditorName
    acc.accountNumber = accountNumber || acc.accountNumber || ''

    accounts.push(finalizeAccount(acc))
  }

  return accounts
}

function extractCreditorInfo(lines: string[], accountInfoIdx: number): { creditorName: string; accountNumber: string } {
  let creditorName = ''
  let accountNumber = ''

  for (let j = accountInfoIdx - 1; j >= Math.max(0, accountInfoIdx - 15); j--) {
    const t = lines[j].trim()
    if (!t) continue
    if (t === 'Account Information') continue
    if (t.startsWith('https://') || t.startsWith('6/') || t.startsWith('')) continue
    if (t.match(/^\d+\/\d+$/)) continue

    const m = t.match(/^(.+?)\s+([A-Za-z0-9]+\*{3,4}|[A-Za-z0-9]{4,})$/)
    if (m) {
      creditorName = m[1].trim()
      accountNumber = m[2]
    } else {
      creditorName = t
    }
    break
  }

  return { creditorName, accountNumber }
}

const FIELD_PREFIXES = [
  'Address', 'Phone', 'Date Opened', 'Responsibility', 'Account Type',
  'Loan Type', 'Balance', 'Date Updated', 'Payment Received', 'Last Payment Made',
  'Pay Status', 'Terms', 'Date Closed', 'Remarks', 'Payment History',
  'Account Information', 'Monthly Payment', 'High Balance', 'Credit Limit',
  'Estimated',
]

function isFieldHeader(s: string): boolean {
  return FIELD_PREFIXES.some(p => s.startsWith(p))
}

function extractFieldValue(line: string): string {
  // Extract value after field name on same line in pdftotext -layout format
  // e.g., "Monthly Payment  $0" or "Balance  $505" or "Date Opened  12/22/2020"
  const parts = line.split(/\s{3,}/).filter(Boolean)
  if (parts.length >= 2) {
    for (let p = 1; p < parts.length; p++) {
      const v = parts[p].trim()
      if (v && v !== '-' && v !== '–' && !isFieldHeader(v)) return v
    }
  }

  // Fallback: single-space format from pdfjs-dist extraction
  // e.g., "Monthly Payment $0" or "Balance $505" or "Date Opened 12/22/2020"
  const trimmed = line.trim()
  for (const prefix of FIELD_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      const val = trimmed.slice(prefix.length).trim()
      if (val && val !== '-' && val !== '–') return val
      break
    }
  }

  return ''
}

function parseAccountChunk(lines: string[]): Partial<Account> | null {
  const acc: Partial<Account> = {}

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t === 'Account Information' || !t) continue

    const lower = t.toLowerCase()

    // Skip payment history grid lines
    if (['past due', 'amount paid', 'scheduled', 'rating', 'total months']
        .some(s => lower.startsWith(s) && lower.length < 20)) continue

    if (lower.startsWith('monthly payment')) {
      acc.monthlyPayment = parseAmount(extractFieldValue(t))
    } else if (lower.startsWith('date opened')) {
      acc.dateOpened = extractFieldValue(t)
    } else if (lower.startsWith('responsibility')) {
      acc.responsibility = extractFieldValue(t)
    } else if (lower.startsWith('account type')) {
      const val = extractFieldValue(t).toLowerCase()
      if (val.includes('revolving')) acc.accountType = 'Revolving'
      else if (val.includes('installment')) acc.accountType = 'Installment'
      else if (val.includes('mortgage')) acc.accountType = 'Mortgage'
      else if (val.includes('collection')) acc.accountType = 'Collection'
      else if (val.includes('student')) acc.accountType = 'Student Loan'
      else if (val.includes('auto')) acc.accountType = 'Auto'
      else acc.accountType = 'Other'
    } else if (lower.startsWith('balance') && !lower.includes('high') && !lower.includes('original') && t.includes('$')) {
      const val = extractFieldValue(t)
      if (val) {
        acc.balance = parseAmount(val)
      }
    } else if (lower.startsWith('date updated')) {
      const val = extractFieldValue(t)
      if (val) acc.dateUpdated = val
    } else if (lower.startsWith('high balance') && !lower.includes(' of ')) {
      const val = extractFieldValue(t)
      if (val) {
        const m = val.match(/\$[\d,]+/)
        if (m) acc.highBalance = parseAmount(m[0])
      }
    } else if (lower.startsWith('pay status')) {
      let val = extractFieldValue(t)
      val = val.replace(/[<>]/g, '')
      acc.payStatus = val
    } else if (lower.startsWith('terms')) {
      acc.terms = extractFieldValue(t)
    } else if (lower.startsWith('date closed')) {
      acc.dateClosed = extractFieldValue(t)
    } else if (lower.startsWith('credit limit') && !lower.includes('(hist')) {
      let val = extractFieldValue(t)
      if (!val) {
        // TU format: "Credit limit of $1,500 from ...; $650 from" - extract last dollar amount
        const allDollars = t.match(/\$[\d,]+/g)
        if (allDollars && allDollars.length > 0) val = allDollars[allDollars.length - 1]
      }
      if (val) {
        const m = val.match(/\$[\d,]+/)
        if (m) acc.creditLimit = parseAmount(m[0])
      }
    } else if (lower.startsWith('credit limit (hist')) {
      // Skip historical credit limit lines
    } else if (lower.startsWith('estimated month')) {
      let nextIdx = i + 1
      while (nextIdx < lines.length && lines[nextIdx].trim() === '') nextIdx++
      const nextLine = lines[nextIdx]?.trim() || ''
      if (nextLine === 'removed') {
        acc.estimatedRemovalDate = extractFieldValue(t)
      }
    } else if (lower.startsWith('remarks')) {
      // Capture context from line before Remarks (often has SETTLED info)
      let preLine = ''
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const pl = lines[j].trim()
        if (!pl || isFieldHeader(pl)) continue
        if (pl.toLowerCase().includes('settled') || pl.toLowerCase().includes('account closed')) {
          preLine = pl
          break
        }
      }
      const parts: string[] = []
      if (preLine) parts.push(preLine)
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const nl = lines[j].trim()
        if (!nl || isFieldHeader(nl)) break
        parts.push(nl)
      }
      if (parts.length > 0) acc.remarks = parts.join(' ')
    }
  }

  return Object.keys(acc).length > 1 ? acc : null
}

function extractInquiries(lines: string[], text: string): Inquiry[] {
  const inquiries: Inquiry[] = []

  // Only extract hard inquiries from "Regular Inquiries" section
  // Skip "Account Review Inquiries" (soft) — not useful for summary
  const hardSection = text.match(/Regular Inquiries[\s\S]*?(?=Account Review Inquiries|Public Record|End of Credit File|$)/i)
  if (hardSection) parseInquiries(hardSection[0], inquiries)

  return inquiries
}

function parseInquiries(block: string, inquiries: Inquiry[]) {
  const blockLines = block.split('\n')

  // Format in the TU TXT file:
  // [COMPANY NAME]...[URL artifacts]
  // Name
  // Location
  // [Address]
  // [City, ST ZIP]   Requested On
  // [date(s)]
  // Phone
  // [phone]   Inquiry Type
  // Individual
  //
  // Find lines with "Requested On", then scan backward for company name

  for (let i = 0; i < blockLines.length; i++) {
    const line = blockLines[i].trim()
    if (!line.includes('Requested On')) continue

    const dateLine = i + 1 < blockLines.length ? blockLines[i + 1].trim() : ''
    const dates = dateLine.match(/\d{1,2}\/\d{1,2}\/\d{4}/g)
    if (!dates) continue

    // Scan backward from 'Requested On' line to find company name
    // Skip "Name", "Location", address lines, blank lines
    let companyName = ''
    for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
      const t = blockLines[j].trim()
      if (!t || t === 'Name' || t.startsWith('Location') || t.startsWith('PO BOX') ||
          t.startsWith('P.O. BOX') || t.startsWith('LOCKBOX') || t.match(/^\d+\s/)) continue
      // URL lines
      if (t.startsWith('https://') || t.includes('transunion.com')) continue
      companyName = t.replace(/https?:\/\/\S+.*$/, '').trim()
      break
    }

    if (!companyName) continue

    // Clean up company name
    companyName = companyName.replace(/[<>]/g, '').trim()
    // Remove trailing URL artifacts
    companyName = companyName.replace(/\s*\d+\/\d+\/\d+.*$/, '').trim()

    // Only add if it looks like a real company name (2+ uppercase letters)
    if (companyName.length < 2) continue

    for (const date of dates) {
      if (!inquiries.some(inq => inq.creditorName === companyName && inq.date === date)) {
        inquiries.push({
          bureau: 'TransUnion' as Bureau,
          creditorName: companyName,
          date,
          type: 'Hard',
        })
      }
    }
  }
}

function extractAccountsRegex(text: string): Account[] {
  const accounts: Account[] = []

  // Split on "Account Information" or "Account Info" (case-insensitive)
  const chunks = text.split(/(?=[A-Z][a-z].*?Account\s+(?:Information|Info))/i)

  for (const chunk of chunks) {
    const trimmed = chunk.trim()
    if (!trimmed || trimmed.length < 20) continue
    if (!/account\s+(?:information|info)/i.test(trimmed)) continue

    const acc: Partial<Account> = {}

    // Extract creditor name: look for a capitalized line before "Account Information"
    const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean)
    let accInfoIdx = -1
    for (let i = 0; i < lines.length; i++) {
      if (/account\s+(?:information|info)/i.test(lines[i]) && !lines[i].match(/^\s/)) {
        accInfoIdx = i
        break
      }
    }

    if (accInfoIdx < 0) continue

    // Scan backward from "Account Information" for the creditor name
    for (let j = accInfoIdx - 1; j >= 0; j--) {
      const t = lines[j]
      if (!t || t.startsWith('https://') || t.match(/^\d+\/\d+$/) || t.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) continue
      if (/^(?:Address|Phone|Date|Responsibility|Account|Loan|Balance|Pay\s|Terms|Monthly|High|Credit|Estimated|Remarks)/i.test(t)) continue
      acc.creditorName = t.replace(/\s+\d+\/\d+\/\d+.*$/, '').replace(/[<>]/g, '').trim()
      break
    }

    if (!acc.creditorName) continue
    if (acc.creditorName.length < 2 || acc.creditorName.includes('Personal') && acc.creditorName.includes('Credit')) continue

    // Extract account number
    const anMatch = trimmed.match(/Account\s+Number[:\s]+([A-Za-z0-9]+\*{3,}|[A-Za-z0-9]{4,})/i)
    if (anMatch) acc.accountNumber = anMatch[1].trim()

    // Extract fields using regex on the chunk text
    const mpMatch = trimmed.match(/Monthly\s+Payment\s+\$?([\d,]+)/i)
    if (mpMatch) acc.monthlyPayment = parseAmount(mpMatch[1])

    const doMatch = trimmed.match(/Date\s+Opened\s+(\d{1,2}\/\d{1,2}\/\d{4})/)
    if (doMatch) acc.dateOpened = doMatch[1]

    const respMatch = trimmed.match(/Responsibility\s+(Individual|Joint|Maker|Authorized\s+User|Co-signer)/i)
    if (respMatch) acc.responsibility = respMatch[1]

    const atMatch = trimmed.match(/Account\s+Type\s+(.+?)(?:\n|$)/i)
    if (atMatch) {
      const val = atMatch[1].trim().toLowerCase()
      if (val.includes('revolving')) acc.accountType = 'Revolving'
      else if (val.includes('installment')) acc.accountType = 'Installment'
      else if (val.includes('mortgage')) acc.accountType = 'Mortgage'
      else if (val.includes('collection')) acc.accountType = 'Collection'
      else if (val.includes('student')) acc.accountType = 'Student Loan'
      else if (val.includes('auto')) acc.accountType = 'Auto'
      else acc.accountType = 'Other'
    }

    const balMatch = trimmed.match(/(?<!\w)Balance\s+\$?([\d,]+)(?!\s*\(hist)/i)
    if (balMatch) acc.balance = parseAmount(balMatch[1])

    const duMatch = trimmed.match(/Date\s+Updated\s+(\d{1,2}\/\d{1,2}\/\d{4})/)
    if (duMatch) acc.dateUpdated = duMatch[1]

    const hbMatch = trimmed.match(/High\s+Balance\s+\$?([\d,]+)/i)
    if (hbMatch) acc.highBalance = parseAmount(hbMatch[1])

    const psMatch = trimmed.match(/Pay\s+Status\s+(.+?)(?:\n|$)/i)
    if (psMatch) {
      acc.payStatus = psMatch[1].replace(/[<>]/g, '').trim()
    }

    const termsMatch = trimmed.match(/Terms\s+(.+?)(?:\n|$)/i)
    if (termsMatch) acc.terms = termsMatch[1].trim()

    const dcMatch = trimmed.match(/Date\s+Closed\s+(\d{1,2}\/\d{1,2}\/\d{4})/)
    if (dcMatch) acc.dateClosed = dcMatch[1]

    const clMatch = trimmed.match(/Credit\s+Limit\s+\$?([\d,]+)/i)
    if (clMatch) acc.creditLimit = parseAmount(clMatch[1])

    const remarksMatch = trimmed.match(/Remarks\s+(.+?)(?:\n\s*(?:Account|Date|Monthly|Pay\s|Terms|High|Credit|Estimated)|$)/i)
    if (remarksMatch) acc.remarks = remarksMatch[1].trim()

    accounts.push(finalizeAccount(acc))
  }

  return accounts
}

function finalizeAccount(acc: Partial<Account>): Account {
  const payStatus = (acc.payStatus || '').toLowerCase()
  const remarks = (acc.remarks || '').toLowerCase()

  const hasDerogatoryPayStatus =
    payStatus.includes('charge') ||
    payStatus.includes('collection') ||
    (payStatus.includes('late') && !payStatus.includes('never')) ||
    payStatus.includes('delinquent') ||
    payStatus.includes('bad debt') ||
    payStatus.includes('past due')

  const isDerogatory = acc.isDerogatory ||
    hasDerogatoryPayStatus ||
    remarks.includes('settled') ||
    remarks.includes('charge off') ||
    remarks.includes('collection') ||
    remarks.includes('less than full') ||
    payStatus.includes('settled')

  const isChargeOff = acc.isChargeOff ||
    payStatus.includes('charge off') ||
    payStatus.includes('charge-off') ||
    payStatus.includes('charged off') ||
    payStatus.startsWith('charge') ||
    remarks.includes('charge off')

  const isCollection = acc.isCollection ||
    payStatus.includes('collection') ||
    remarks.includes('collection')

  const isLate = acc.isLate || hasDerogatoryPayStatus

  const isClosed = acc.isClosed ||
    payStatus.includes('closed') ||
    payStatus.includes('paid')

  const isOpen = acc.isOpen || (!isClosed && !isChargeOff && !isCollection)

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
    pastDue: acc.pastDue,
    highBalance: acc.highBalance,
    creditLimit: acc.creditLimit,
    monthlyPayment: acc.monthlyPayment,
    payStatus: acc.payStatus || '',
    responsibility: acc.responsibility,
    terms: acc.terms,
    remarks: acc.remarks,
    paymentHistory: [],
    isDerogatory,
    isChargeOff,
    isCollection,
    isLate,
    isOpen,
    isClosed,
    derogatoryCount: 0,
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

  const revolvingAccounts = accounts.filter(a => a.accountType === 'Revolving' && (a.creditLimit || 0) > 0)
  const revBalances = revolvingAccounts.reduce((s, a) => s + a.balance, 0)
  const revLimits = revolvingAccounts.reduce((s, a) => s + (a.creditLimit || 0), 0)
  const creditUtilization = revLimits > 0 ? (revBalances / revLimits) * 100 : 0
  const totalCreditLimit = revLimits

  return {
    totalAccounts, openAccounts, closedAccounts,
    derogatoryAccounts, chargeOffs, collections,
    lateAccounts, hardInquiries, softInquiries,
    publicRecords: publicRecords.length, bankruptcies,
    totalBalance, totalCreditLimit, creditUtilization,
  }
}

function parseAmount(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/[^0-9.-]/g, '')) || 0
}
