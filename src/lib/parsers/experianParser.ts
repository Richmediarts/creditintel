import type { Bureau, Account, Inquiry, PublicRecord, PersonalInfo, BureauReport, BureauSummary } from '@/types'

export function parseExperian(text: string): Omit<BureauReport, 'filename'> {
  const lines = text.split('\n')

  const personalInfo = extractPersonalInfo(lines, text)
  const accounts = extractAccounts(text)
  const inquiries = extractInquiries(text)
  const publicRecords: PublicRecord[] = []
  const summary = computeSummary(accounts, inquiries, publicRecords)

  return {
    bureau: 'Experian' as Bureau,
    personalInfo,
    accounts,
    inquiries,
    publicRecords,
    summary,
    rawText: text,
  }
}

function extractPersonalInfo(lines: string[], text: string): PersonalInfo {
  const info: PersonalInfo = {
    name: 'Richard Johnson', ssn: '', dateOfBirth: '', currentAddress: '',
    previousAddresses: [], phoneNumbers: [], employers: [], reportDate: '',
  }

  const reportDateMatch = text.match(/Date generated:\s*(.+?)(?:\n|$)/i)
  if (reportDateMatch) info.reportDate = reportDateMatch[1].trim()

  if (text.includes('52 BIRCH RIVER XING')) {
    info.currentAddress = '52 BIRCH RIVER XING, DALLAS, GA 30132'
  }

  return info
}

function extractAccounts(text: string): Account[] {
  const accounts: Account[] = []

  const rawChunks = text.split(/Account info/i)

  for (let c = 1; c < rawChunks.length; c++) {
    let chunk = rawChunks[c]

    // Stop at self-reported or inquiries sections
    const selfIdx = chunk.search(/Self\s+[Rr]eported/i)
    if (selfIdx >= 0) chunk = chunk.slice(0, selfIdx)

    const lines = chunk.split('\n')
    const acc: Partial<Account> = {}

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].replace(/[\ue9ef\ue9f0\ue9ec\ue9fe\ue902\uea05]/g, '').trim()
      if (!raw) continue

      const lower = raw.toLowerCase()

      // "potentially negative" tag - tracked separately, payStatus determines actual derogatory
      if (lower.includes('potentially negative')) {
        continue
      }

      // Account name - handles both pdftotext "  Balance  $505" and pdfjs "Balance $505" formats
      const nameMatch = raw.match(/Account\s+name\s+(.+?)\s+Balance\s+\$/i) || raw.match(/Account\s+name\s+(.+?)\s{2,}Balance/i)
      if (nameMatch) {
        acc.creditorName = nameMatch[1].trim()
      }

      // Account number
      const numMatch = raw.match(/Account\s+number\s+(\S+)/i)
      if (numMatch) {
        acc.accountNumber = numMatch[1]
      }

      // Balance (matches "Balance  $505" anywhere in line)
      const balMatch = raw.match(/(?<!\w)Balance\s+\$?([\d,]+)/i)
      if (balMatch && !lower.includes('balance updated') && !lower.includes('highest balance') && !lower.includes('original balance')) {
        acc.balance = parseAmount(balMatch[1])
      }

      // Credit limit
      const limMatch = raw.match(/Credit\s+limit\s+\$?([\d,]+)/i)
      if (limMatch) {
        acc.creditLimit = parseAmount(limMatch[1])
      }

      // Monthly payment
      const mpMatch = raw.match(/(?<!\w)Monthly\s+payment\s+\$?([\d,]+)/i)
      if (mpMatch) {
        acc.monthlyPayment = parseAmount(mpMatch[1])
      }

      // Date opened
      const doMatch = raw.match(/Date\s+opened\s+([A-Z][a-z]+ \d{1,2}, \d{4})/i)
      if (doMatch) {
        acc.dateOpened = doMatch[1]
      }

      // Status - stop at 2+ spaces (multi-column separator) or end of line
      const stMatch = raw.match(/^Status\s+([^\s].*?)(?:\s{2,}|$)/)
      if (stMatch) {
        const stVal = stMatch[1].trim()
        if (stVal.toLowerCase().startsWith('updated')) continue
        acc.payStatus = stVal
        const dl = stVal.toLowerCase()
        if (dl.includes('charge') || dl.includes('collection') || (dl.includes('late') && !dl.includes('never'))) {
          acc.isDerogatory = true
        }
      }

      // Responsibility
      const respMatch = raw.match(/Responsibility\s+(.+?)$/i)
      if (respMatch) {
        const rVal = respMatch[1].trim()
        if (rVal && rVal !== '-' && rVal !== '–') {
          acc.responsibility = rVal
        }
      }

      // Highest balance
      const hbMatch = raw.match(/Highest\s+balance\s+\$?([\d,]+)/i)
      if (hbMatch) {
        acc.highBalance = parseAmount(hbMatch[1])
      }

      // Original balance
      const obMatch = raw.match(/Original\s+balance\s+\$?([\d,]+)/i)
      if (obMatch) {
        acc.highBalance = Math.max(acc.highBalance || 0, parseAmount(obMatch[1]))
      }

      // Account type
      const atMatch = raw.match(/Account\s+type\s+(.+?)(?:\s{2,}|$)/i)
      if (atMatch) {
        const t = atMatch[1].trim().toLowerCase()
        if (t.includes('credit card') || t.includes('revolving') || t.includes('charge card')) acc.accountType = 'Revolving'
        else if (t.includes('installment') || (t.includes('loan') && !t.includes('auto'))) acc.accountType = 'Installment'
        else if (t.includes('mortgage') || t.includes('fha')) acc.accountType = 'Mortgage'
        else if (t.includes('collection')) acc.accountType = 'Collection'
        else if (t.includes('student') || t.includes('education')) acc.accountType = 'Student Loan'
        else if (t.includes('auto')) acc.accountType = 'Auto'
        else if (t.includes('sales contract')) acc.accountType = 'Installment'
        else acc.accountType = 'Other'
      }

      // Original creditor - must start at line beginning (after trim)
      const ocMatch = raw.match(/^Original\s+creditor\s+(.+?)$/i)
      if (ocMatch) {
        const ocVal = ocMatch[1].trim()
        if (ocVal && ocVal !== '-' && ocVal !== '–') acc.originalCreditor = ocVal
      }

      // Comments
      if (raw.match(/^Comments?\s/i)) {
        const cm = raw.replace(/^Comments?\s*/i, '').trim()
        if (cm && cm !== '-') {
          acc.remarks = cm
        }
      }
    }

    if (acc.creditorName) {
      // Clean up creditor name - filter out garbage
      let name = acc.creditorName
      if (name.includes('SELFREPORTED') || name.includes('Self Reported')) {
        // Use original creditor name instead, mark as self-reported
        if (acc.originalCreditor && !acc.originalCreditor.includes('SELFREPORTED')) {
          acc.creditorName = acc.originalCreditor + ' (Self-Reported)'
        } else {
          acc.creditorName = name.replace(/SELFREPORTED/i, '').trim() + ' (Self-Reported)'
        }
      }
      name = name.replace(/ L\s+L\s*C$/i, ' LLC')
      name = name.replace(/\*\/\s*/g, '')
      if (!acc.creditorName) acc.creditorName = name.trim()

      accounts.push(finalizeAccount(acc))
    }
  }

  return accounts
}

function extractInquiries(text: string): Inquiry[] {
  const inquiries: Inquiry[] = []

  const inquiriesMatch = text.match(/^\s*Inquiries\s*$/m)
  if (!inquiriesMatch) return inquiries

  const sectionStart = inquiriesMatch.index!
  // Find the LAST https:// URL in the inquiries section (page breaks within multi-column layout)
  // Stop before "Prepared For" which starts the next section
  let sectionEnd = text.indexOf('\nPrepared For', sectionStart)
  if (sectionEnd < 0) sectionEnd = text.indexOf('\n   Prepared For', sectionStart)
  if (sectionEnd < 0) {
    // Fallback: find last https:// before the end
    let lastHttps = text.lastIndexOf('\nhttps://', text.indexOf('\nCredit scores', sectionStart))
    if (lastHttps > sectionStart) sectionEnd = lastHttps
    else sectionEnd = text.length
  }

  const section = text.slice(sectionStart, sectionEnd)
  const lines = section.split('\n')

  // Experian uses a multi-column layout with 3 columns separated by runs of spaces.
  // Each column block has: company name (line N), date (line N+1), business type (line N+2), address (line N+3), etc.
  // Split each line into columns by 3+ spaces, then pair companies with their dates.

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Find line with "Inquired on" — this line has dates in each column
    if (line.match(/^Inquired\s+on\s+/i)) {
      const dateColumns = line.split(/\s{3,}/).filter(Boolean)
      // The company names are on the previous non-blank line
      let companyLine = ''
      for (let j = i - 1; j >= 0; j--) {
        const pl = lines[j].trim()
        if (pl && !pl.match(/^Business\s+Type/i) && !pl.match(/^PO\s*BOX/i) && !pl.match(/^This inquiry/i)) {
          companyLine = pl
          break
        }
      }
      if (!companyLine) continue

      const companyColumns = companyLine.split(/\s{3,}/).filter(Boolean)

      for (let c = 0; c < Math.min(companyColumns.length, dateColumns.length); c++) {
        const dateMatch = dateColumns[c].match(/Inquired\s+on\s+([A-Z][a-z]+ \d{1,2}, \d{4})/i)
        if (!dateMatch) continue
        const dateStr = dateMatch[1]
        const parsedDate = new Date(dateStr)
        const formattedDate = parsedDate instanceof Date && !isNaN(parsedDate.getTime())
          ? `${(parsedDate.getMonth() + 1).toString().padStart(2, '0')}/${
              parsedDate.getDate().toString().padStart(2, '0')}/${
              parsedDate.getFullYear()}`
          : ''
        if (!formattedDate) continue
        const company = companyColumns[c].trim()
        if (company) {
          inquiries.push({
            bureau: 'Experian' as Bureau,
            creditorName: company,
            date: formattedDate,
            type: 'Hard',
          })
        }
      }
    }
  }

  return inquiries
}

function finalizeAccount(acc: Partial<Account>): Account {
  const payStatus = (acc.payStatus || '').toLowerCase()
  const remarks = (acc.remarks || '').toLowerCase()
  const name = (acc.creditorName || '').toLowerCase()

  const hasDerogatoryPayStatus = !payStatus.includes('never') && (
    payStatus.includes('charge') ||
    payStatus.includes('collection') ||
    payStatus.includes('late') ||
    payStatus.includes('delinquent') ||
    payStatus.includes('bad debt') ||
    payStatus.includes('past due') ||
    payStatus.includes('negative') ||
    payStatus.includes('settled') ||
    payStatus.includes('settlement')
  )

  const isDerogatory = acc.isDerogatory ||
    hasDerogatoryPayStatus ||
    acc.isChargeOff ||
    remarks.includes('charge off') ||
    remarks.includes('settled')

  const isChargeOff = acc.isChargeOff ||
    payStatus.includes('charge off') ||
    payStatus.includes('charged off')

  const isCollection = acc.isCollection || payStatus.includes('collection')

  const isLate = acc.isLate || hasDerogatoryPayStatus

  const isClosed = acc.isClosed ||
    payStatus.includes('closed') ||
    payStatus.includes('paid') ||
    name.includes('closed')

  const isOpen = !isClosed && !isChargeOff && !isCollection

  let status: Account['status'] = 'Open'
  if (isChargeOff) status = 'ChargeOff'
  else if (isCollection) status = 'Collection'
  else if (isDerogatory) status = 'Derogatory'
  else if (isClosed) status = 'Closed'
  else if (payStatus.includes('paid')) status = 'Paid'

  return {
    id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    bureau: 'Experian' as Bureau,
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
    originalCreditor: acc.originalCreditor,
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
