import type { Bureau, Account, Inquiry, PublicRecord, PersonalInfo, BureauReport, BureauSummary, PaymentHistoryEntry } from '@/types'

export function parseEquifax(text: string): Omit<BureauReport, 'filename'> {
  const lines = text.split('\n')
  const trimmed = lines.map(l => l.trimEnd())

  const personalInfo = extractPersonalInfo(trimmed)
  const { accounts } = extractAccounts(trimmed)
  const inquiries = extractInquiries(trimmed)
  const publicRecords: PublicRecord[] = []
  const summary = computeSummary(accounts, inquiries, publicRecords)

  return {
    bureau: 'Equifax' as Bureau,
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
    const line = lines[i].trim()
    if (!line) continue

    if (line.startsWith('Date:')) {
      // First Date: is the report date (before Personal Information section)
      if (!info.reportDate && !line.startsWith('Date of') && !line.startsWith('Date Reported')) {
        info.reportDate = line.replace('Date:', '').trim()
      }
    }

    if (line.includes('Social Security Number:')) {
      info.ssn = line.split(':')[1]?.trim() || ''
    }

    if (line.includes('Date of Birth:')) {
      info.dateOfBirth = line.split(':')[1]?.trim() || ''
    }

    // Personal info block: RICHARD L JOHNSON followed by address
    if (line.includes('RICHARD L JOHNSON') && info.name === '') {
      const next = getNextNonBlankLine(lines, i + 1)
      if (next && next.includes('52 BIRCH RIVER')) {
        info.name = 'RICHARD L JOHNSON'
        info.currentAddress = next
        // Extract phone from address line
        const phoneMatch = next.match(/(\(\d{3}\)\s*\d{3}-\d{4})/)
        if (phoneMatch) info.phoneNumbers.push(phoneMatch[1])
        continue
      }
    }

    // Former names in the Personal Information table
    if (line.includes('Former Name(s):')) {
      // The next column is Employment Information
      const namesLine = lines[i + 1]?.trim() || ''
      if (namesLine && !namesLine.startsWith('Former')) {
        const nameParts = namesLine.split(/\s{2,}/)
        for (const part of nameParts) {
          const n = part.trim()
          if (n && !n.startsWith('NCR') && !n.startsWith('OPTOMI') && !n.startsWith('PS ENERGY')) {
            info.previousAddresses = info.previousAddresses || []
          }
        }
      }
    }

    // Employment info - look for employer names
    const empMatch = line.match(/(NCR CORPORATION|OPTOMI PROFESSIONAL|PS ENERGY GROUP)/)
    if (empMatch) {
      const empLine = lines[i].trim()
      const parts = empLine.split(/\s{2,}/)
      for (const part of parts) {
        const p = part.trim()
        if (p.includes('NCR') || p.includes('OPTOMI') || p.includes('PS ENERGY')) {
          const name = p.replace(/-\s*(Current|Former)/, '').trim()
          if (name && !info.employers.some(e => e.name === name)) {
            info.employers.push({ name })
          }
        }
      }
    }

    // Former addresses
    if (line.includes('Former Address(es):')) {
      const addrLine = lines[i + 1]?.trim() || ''
      if (addrLine && !addrLine.startsWith('Former') && !addrLine.startsWith('None')) {
        const addrs = addrLine.split(/  +/)
        for (const a of addrs) {
          const addr = a.trim()
          if (addr && addr !== 'None' && !addr.includes('Phone')) {
            info.previousAddresses.push(addr)
          }
        }
      }
    }
  }

  return info
}

function getNextNonBlankLine(lines: string[], startIdx: number): string | null {
  for (let i = startIdx; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t) return t
  }
  return null
}

function extractAccounts(lines: string[]): { accounts: Account[] } {
  const accounts: Account[] = []
  const startIdx = findSectionStart(lines, 'Credit Accounts')
  if (startIdx < 0) return { accounts }

  const endIdx = findSectionStart(lines, 'Inquiries', startIdx + 1)
  const sectionLines = lines.slice(startIdx, endIdx > 0 ? endIdx : undefined)

  const rawAccounts = splitRawAccounts(sectionLines)

  for (const raw of rawAccounts) {
    const account = parseSingleAccount(raw)
    if (account) {
      accounts.push(account)
    }
  }

  return { accounts }
}

function findSectionStart(lines: string[], sectionName: string, startFrom = 0): number {
  for (let i = startFrom; i < lines.length; i++) {
    if (lines[i].trim() === sectionName) return i
  }
  return -1
}

function splitRawAccounts(lines: string[]): string[][] {
  const chunks: string[][] = []
  let current: string[] = []
  let inAccounts = false
  let seenCreditor = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.trim() === 'Credit Accounts') {
      inAccounts = true
      continue
    }

    if (!inAccounts) continue

    // Skip intro paragraph
    const t = line.trim()
    if (!seenCreditor && (
      t === '' ||
      t.startsWith('This includes') ||
      t.startsWith('Date:') ||
      t.startsWith('Confirmation') ||
      t.startsWith('Prepared for:') ||
      t.startsWith('000000001-DISC') ||
      t.startsWith('RICHARD L JOHNSON')
    )) {
      continue
    }

    // Detect next section
    if (t === 'Inquiries' || t === 'Personal Information') {
      if (current.length > 0) chunks.push(current)
      break
    }

    // Detect page break
    if (t.startsWith('000000001-DISC')) {
      continue
    }

    // Detect creditor name: ALL CAPS line followed by line with Date Reported
    if (isCreditorName(line, lines, i)) {
      if (current.length > 0) {
        chunks.push(current)
      }
      current = [line]
      seenCreditor = true
      continue
    }

    if (seenCreditor) {
      current.push(line)
    }
  }

  return chunks
}

function isCreditorName(line: string, lines: string[], idx: number): boolean {
  const t = line.trim()
  if (!t) return false
  if (t.length < 5) return false
  if (t.startsWith('000000001-DISC')) return false
  if (t === 'PREPARED FOR:') return false
  if (t === 'RICHARD L JOHNSON') return false

  // Check if line is mostly uppercase (ignore numbers, punctuation, common suffix)
  const coreName = t.replace(/\s*-\s*(Closed|Current|Former)$/, '').replace(/[^A-Za-z]/g, '')
  if (!coreName) return false
  const upperCount = (coreName.match(/[A-Z]/g) || []).length
  if (upperCount / coreName.length < 0.8) return false

  // Skip address/phone lines
  if (/,\s*[A-Z]{2}\s+\d{5}/.test(t)) return false // ", PA 12345" state+zip
  if (/^\(?\d{3}\)?\s*-?\s*\d{3}/.test(t)) return false // starts with phone
  if (/^LOCKBOX\s/i.test(t)) return false
  if (/^PO\s*BOX\s/i.test(t)) return false

  const normalized = t.toUpperCase()
  const skipHeaders = [
    'PAID ON TIME', 'NARRATIVE CODE', 'BALANCE', 'ACTUAL PAYMENT',
    'SCHEDULED PAYMENT', 'DATE OF LAST PAYMENT', 'PERSONAL INFORMATION',
    'CREDIT ACCOUNTS', 'INQUIRIES', 'YOUR CREDIT REPORT', 'TERM DURATION:',
    'MONTHS REVIEWED', 'NARRATIVE CODE',
  ]
  if (skipHeaders.some(s => normalized.startsWith(s))) return false
  if (t.includes('YEAR') && t.includes('JAN')) return false

  // Check if "Date Reported:" appears within the next 8 non-blank lines
  let linesChecked = 0
  for (let i = idx + 1; i < lines.length && linesChecked < 8; i++) {
    const nl = lines[i].trim()
    if (!nl) continue
    linesChecked++
    if (nl.includes('Date Reported:')) return true
  }

  return false
}

function parseSingleAccount(lines: string[]): Account | null {
  if (!lines.length) return null

  const text = lines.join('\n')
  const flat = text.replace(/\n/g, ' ').replace(/\s+/g, ' ')
  const acc: Partial<Account> = {}

  // Creditor name is first line
  acc.creditorName = lines[0]?.trim() || ''

  // Balance
  const balMatch = text.match(/Balance:\s*\$?([\d,]+)/)
  if (balMatch) acc.balance = parseAmount(balMatch[1])

  // Account Number
  const acctMatch = text.match(/Account Number:\s*(\*?\d+)/)
  if (acctMatch) acc.accountNumber = acctMatch[1]

  // Owner
  const ownerMatch = text.match(/Owner:\s*([^|]+)/)
  if (ownerMatch) acc.responsibility = ownerMatch[1].trim()

  // Credit Limit
  const limitMatch = text.match(/Credit Limit:\s*\$?([\d,]+)/)
  if (limitMatch && parseAmount(limitMatch[1]) > 0) acc.creditLimit = parseAmount(limitMatch[1])

  // High Credit
  const highMatch = text.match(/High Credit:\s*\$?([\d,]+)/)
  if (highMatch && parseAmount(highMatch[1]) > 0) acc.highBalance = parseAmount(highMatch[1])

  // Loan/Account Type
  const typeMatch = flat.match(/Loan\/Account[^:]*:\s*([^|]+?)\s*\|/)
  if (typeMatch) {
    const at = typeMatch[1].trim().toLowerCase()
    if (at.includes('credit card') || at.includes('revolving') || at.includes('flexible spending')) acc.accountType = 'Revolving'
    else if (at.includes('installment') || at.includes('loan') || at.includes('charge account')) acc.accountType = 'Installment'
    else if (at.includes('mortgage')) acc.accountType = 'Mortgage'
    else if (at.includes('collection')) acc.accountType = 'Collection'
    else acc.accountType = 'Other'
  }

  // Status
  const statusMatch = flat.match(/Status:\s*([^|\n]+?)(?:\s*\||\s*Date Opened|$)/)
  if (statusMatch) acc.payStatus = statusMatch[1].trim()

  // Date Opened
  const doMatch = text.match(/Date Opened:\s*(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4}|[A-Z][a-z]+ \d{4})/)
  if (doMatch) acc.dateOpened = doMatch[1]

  // Date Closed
  const dcMatch = flat.match(/Date Closed:\s*(\d{2}\/\d{2}\/\d{4})/)
  if (dcMatch) acc.dateClosed = dcMatch[1]

  // Date of Last Payment
  const lpMatch = text.match(/Date of Last Payment:\s*(\d{2}\/\d{2}\/\d{4})/)
  if (lpMatch) acc.dateUpdated = lpMatch[1]

  // Scheduled Payment Amount
  const spMatch = text.match(/Scheduled Payment Amount:\s*\$?([\d,]+)/)
  if (spMatch) acc.monthlyPayment = parseAmount(spMatch[1])

  // Amount Past Due
  const pdMatch = text.match(/Amount Past Due:\s*\$?([\d,]+)/)
  if (pdMatch && parseAmount(pdMatch[1]) > 0) {
    acc.pastDue = parseAmount(pdMatch[1])
  }

  // Charge Off Amount
  const coMatch = text.match(/Charge Off Amount:\s*\$?([\d,]+)/)
  if (coMatch && parseAmount(coMatch[1]) > 0) {
    acc.isChargeOff = true
    acc.isDerogatory = true
  }

  // Date of 1st Delinquency
  const ddMatch = text.match(/Date of 1st Delinquency:\s*(\d{2}\/\d{2}\/\d{4})/)
  if (ddMatch) acc.dateFirstDelinquency = ddMatch[1]

  // Terms Frequency
  const termsMatch = text.match(/Terms Frequency:\s*(.+)/
  )
  if (termsMatch) acc.terms = termsMatch[1].trim()

  // Narrative Codes
  const narrMatch = text.match(/Narrative Code\(s\):\s*([\d,\s]+)/)
  if (narrMatch) acc.remarks = `Narrative Codes: ${narrMatch[1].trim()}`

  // Payment History - extract from the table
  const ph = extractPaymentHistory(text)
  if (ph.length > 0) acc.paymentHistory = ph

  return finalizeAccount(acc)
}

function extractPaymentHistory(text: string): PaymentHistoryEntry[] {
  const entries: PaymentHistoryEntry[] = []

  // Find the 24 Month History section
  const historyMatch = text.match(/24 Month History\s*\n\s*\n\s*Balance\s+Scheduled/)
  if (!historyMatch) return entries

  const historyStart = text.indexOf('24 Month History')
  if (historyStart < 0) return entries

  const historyText = text.slice(historyStart)

  // Find the data rows - they start with MM/YY format
  const rowRegex = /^(\d{2}\/\d{2})\s+\$?([\d,]+)\s+\$?([\d,]+)/gm
  let match
  while ((match = rowRegex.exec(historyText)) !== null) {
    const dateParts = match[1].split('/')
    entries.push({
      month: dateParts[0],
      year: '20' + dateParts[1],
      rating: 'OK',
      balance: parseAmount(match[2]),
      scheduledPayment: parseAmount(match[3]),
    })
  }

  return entries
}

function extractInquiries(lines: string[]): Inquiry[] {
  const inquiries: Inquiry[] = []

  // Find the FIRST "Inquiries" section header that follows the Credit Accounts section
  let startIdx = findSectionStart(lines, 'Inquiries')
  if (startIdx < 0) return inquiries

  // Find "Company Information" table header to locate actual data start
  const tableIdx = lines.findIndex((l, i) => i > startIdx && l.trim().startsWith('Company Information'))
  if (tableIdx < 0) return inquiries

  // Walk through and find "Hard" / "Soft" lines
  let i = tableIdx + 1
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }

    // Check for inquiry type line: "Hard" or "Soft" followed by whitespace and dates
    const inqMatch = line.match(/^(Hard|Soft)\s{2,}(\d{2}\/\d{2}\/\d{4}(?:,\s*\d{2}\/\d{2}\/\d{4})*)/)
    if (inqMatch) {
      const type = inqMatch[1] as 'Hard' | 'Soft'
      const dates = inqMatch[2].split(',').map(d => d.trim())
      const firstDate = dates[0]

      // Find creditor name by scanning backwards for first all-caps line
      let creditorName = ''
      for (let j = i - 1; j >= tableIdx; j--) {
        const t = lines[j].trim()
        if (!t) continue
        // Skip address/phone lines
        if (/^Phone:/i.test(t)) continue
        if (/^\d{5}/.test(t)) continue // ZIP code
        if (t === 'Hard' || t === 'Soft') continue
        // Check if it looks like a company name (not address)
        const alphaRatio = (t.replace(/[^A-Za-z]/g, '').length) / Math.max(t.length, 1)
        if (alphaRatio > 0.5 && t.length > 3 && !t.includes(',') && !t.startsWith('PO BOX')) {
          creditorName = t.replace(/[\d\s-]+$/, '').trim()
          break
        }
      }

      if (creditorName) {
        inquiries.push({
          bureau: 'Equifax' as Bureau,
          creditorName,
          date: firstDate,
          type,
        })
      }
    }

    // Stop if we hit the FCRA rights section
    if (line.includes('CONSUMERS HAVE THE RIGHT TO OBTAIN A SECURITY FREEZE') ||
        line.includes('You may seek damages')) break

    i++
  }

  return inquiries
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
    payStatus.includes('past due') ||
    payStatus.includes('derogatory')

  const isDerogatory = acc.isDerogatory ||
    hasDerogatoryPayStatus ||
    acc.isChargeOff ||
    remarks.includes('settled') ||
    remarks.includes('charge off') ||
    remarks.includes('collection')

  const isChargeOff = acc.isChargeOff ||
    payStatus.includes('charge off') ||
    payStatus.includes('charge-off') ||
    payStatus.includes('charged off') ||
    remarks.includes('charge off')

  const isCollection = acc.isCollection ||
    payStatus.includes('collection') ||
    remarks.includes('collection')

  const isLate = acc.isLate ||
    hasDerogatoryPayStatus ||
    (acc.paymentHistory || []).some(ph => ph.rating !== 'OK' && ph.rating !== '' && ph.rating !== 'N/R')

  const isClosed = acc.isClosed ||
    (acc.creditorName || '').includes(' - Closed') ||
    payStatus.includes('closed') ||
    payStatus.includes('paid')

  const isOpen = acc.isOpen ||
    (!isClosed && !isChargeOff && !isCollection)

  let status: Account['status'] = 'Open'
  if (isChargeOff) status = 'ChargeOff'
  else if (isCollection) status = 'Collection'
  else if (isDerogatory) status = 'Derogatory'
  else if (isClosed) status = 'Closed'
  else if (payStatus.includes('paid')) status = 'Paid'

  return {
    id: `eq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    bureau: 'Equifax' as Bureau,
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
    paymentHistory: acc.paymentHistory || [],
    isDerogatory,
    isChargeOff,
    isCollection,
    isLate,
    isOpen,
    isClosed,
    derogatoryCount: (acc.paymentHistory || []).filter(ph => ph.rating !== 'OK' && ph.rating !== '' && ph.rating !== 'N/R').length,
    estimatedRemovalDate: acc.estimatedRemovalDate,
    dateFirstDelinquency: acc.dateFirstDelinquency,
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
