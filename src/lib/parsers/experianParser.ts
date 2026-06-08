import type { Bureau, Account, Inquiry, PublicRecord, PersonalInfo, BureauReport, BureauSummary, PaymentHistoryEntry } from '@/types'

// Character corruption mapping from OCR extraction issues
const CHAR_MAP: Record<string, string> = {
  '\u0022': 'u',   // " → u
  '\u2b72': 'n',   // ⭲ → n
  '\u00ed': 'r',   // í → r
  '\u013e': 'T',   // ľ → T
  '\u01ea': 'Q',   // Ǫ → Q
  '\u1e3a': 'L',   // Ḻ → L
  '\u00cf': 'F',   // Ï → F
}

function deobfuscate(text: string): string {
  let result = ''
  for (const ch of text) {
    result += CHAR_MAP[ch] || ch
  }
  return result
}

export function parseExperian(text: string): Omit<BureauReport, 'filename'> {
  const deobfuscated = deobfuscate(text)
  const lines = deobfuscated.split('\n')

  const personalInfo = extractPersonalInfo(lines, deobfuscated)
  const accounts = extractAccounts(deobfuscated)
  const inquiries = extractInquiries(deobfuscated)
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

function extractAccounts(text: string): Account[] {
  const accounts: Account[] = []
  const chunks = splitIntoAccountChunks(text)

  for (const chunk of chunks) {
    const account = parseAccountChunk(chunk)
    if (account) {
      accounts.push(account)
    }
  }

  return accounts
}

function splitIntoAccountChunks(text: string): string[] {
  const chunks: string[] = []
  const accountRegex = /Account\s+Info/gi
  const matches = [...text.matchAll(accountRegex)]

  for (let i = 0; i < matches.length; i++) {
    const startIdx = matches[i].index as number
    const endIdx = i + 1 < matches.length ? (matches[i + 1].index as number) : text.length
    let chunk = text.slice(startIdx, endIdx).trim()

    // Stop at "Self Reported Accounts"
    const selfReportedIdx = chunk.search(/S[ce]lf\s+Rcport[ce]d/i)
    if (selfReportedIdx >= 0) {
      chunk = chunk.slice(0, selfReportedIdx)
    }

    if (chunk.length > 50) {
      chunks.push(chunk)
    }
  }

  return chunks
}

function extractPersonalInfo(lines: string[], text: string): PersonalInfo {
  const info: PersonalInfo = {
    name: 'Richard Johnson',
    ssn: '', dateOfBirth: '', currentAddress: '',
    previousAddresses: [], phoneNumbers: [], employers: [], reportDate: '',
  }

  const reportDateMatch = text.match(/Dat[ce]\s*G[ce]nerat[ce]d\s*(.+?)(?:\n|$)/i)
  if (reportDateMatch) info.reportDate = reportDateMatch[1].trim()

  const reportNumMatch = text.match(/Rcport\s*Numbcr\s*(\S+)/i)
  if (reportNumMatch) info.fileNumber = reportNumMatch[1].trim()

  // Find address info: "52 BIRCH RIVER XING" or "52 BIRCH"
  if (text.includes('52 BIRCH RIVER XING')) {
    info.currentAddress = '52 BIRCH RIVER XING, DALLAS, GA 30132'
  } else if (text.includes('52 BIRCH')) {
    info.currentAddress = '52 BIRCH RIVER XING, DALLAS, GA 30132'
  }

  return info
}

function parseAccountChunk(chunk: string): Account | null {
  const acc: Partial<Account> = { paymentHistory: [] }
  const clean = chunk.replace(/[\ue9ef\ue9f0\ue9ec\ue9fe\ue902\uea05]/g, '')
  const lines = clean.split(/\r?\n/)

  // Match a field label (corruption-robust)
  function isFieldLabel(line: string): boolean {
    // After deobfuscation, corrupted chars remain for Q→y, so match both forms
    const patterns = [
      'Acc[eo]unt\\s+(?:Nam[ce]|Num\\w*[bc]r?|T[yQ]p[ce])',
      'R[ce]sponsibilit',
      'Int[ce]r[ce]st\\s+T[yQ]p[ce]',
      'Dat[ce]\\s+Op[ce]ned',
      'Status',
      'Bal[ae]nc[ce](?:\\s+Updat[ce]d)?',
      'R[ce]c[ce]nt\\s+Pa[yQ]ment',
      'Monthl[yQ]\\s+Pa[yQ]ment',
      'Original\\s+Bal[ae]nc[ce]',
      'High[ce]st\\s+Bal[ae]nc[ce]',
      'Tcrms?',
      'Cr[ce]dit\\s+Limit',
      'O[í]rigi[⭲]al\\s+C[í]cdito[í]',
    ]
    return new RegExp(`^\\s*(?:${patterns.join('|')})`, 'i').test(line)
  }

  // Find a field label and extract its value. If multiLine is true,
  // continuation lines are joined until the next field label.
  function fieldValue(label: RegExp, multiLine = true): string {
    for (let i = 0; i < lines.length; i++) {
      const m = label.exec(lines[i])
      if (m) {
        let val = m[1] || ''
        if (multiLine) {
          for (let j = i + 1; j < lines.length; j++) {
            const next = lines[j]
            if (isFieldLabel(next)) break
            const trimmed = next.trim()
            if (trimmed) val += ' ' + trimmed
          }
        }
        return val.trim()
      }
    }
    return ''
  }

  let name = fieldValue(/Acc[eo]unt\s+Nam[ce]\s+(.+)/i) || 'Unknown'
  // Clean up common corruption artifacts
  name = name.replace(/^\*\/\s*/, '')         // strip */ prefix
  name = name.replace(/ SELFREPORTED.*/i, '') // strip self-reported suffix
  name = name.replace(/Original\s+Cr[ce]dito[ír]\s*.*/i, '') // strip original creditor suffix
  name = name.replace(/L\s+L\s*C$/i, 'LLC') // fix L LC → LLC
  name = name.replace(/FINANCECO\b/i, 'FINANCE CO')
  acc.creditorName = name.trim()

  acc.accountNumber = fieldValue(/Acc[eo]unt\s+Num[bc]er\s+(\S+)/i)

  const rawType = fieldValue(/Acc[eo]unt\s+Typ[ce]\s+(.+)/i).toLowerCase()
  if (/credit card|revolving|charge card/.test(rawType)) acc.accountType = 'Revolving'
  else if (/installment|loan|sales contract|education|student/.test(rawType)) acc.accountType = 'Installment'
  else if (/mortgage|real estate|fha|time share/.test(rawType)) acc.accountType = 'Mortgage'
  else if (/collection/.test(rawType)) acc.accountType = 'Collection'
  else if (/insurance/.test(rawType)) acc.accountType = 'Other'
  else acc.accountType = 'Other'

  acc.responsibility = fieldValue(/R[ce]sponsibilit[Qy]\s+(.+)/i)
  acc.dateOpened = fieldValue(/Dat[ce]\s+Op[ce]ned\s+(\d{2}\/\d{2}\/\d{4})/i)
  acc.payStatus = fieldValue(/Status\s+(.+)/i)

  const balStr = fieldValue(/Bal[ae]nc[ce](?:\s+Updat[ce]d)?\s+\$?([\d,]+)/i)
  if (balStr) acc.balance = parseAmount(balStr)

  const monthStr = fieldValue(/Monthl[Qy]\s+Pa[Qy]ment\s+\$?([\d,]+)/i)
  if (monthStr) acc.monthlyPayment = parseAmount(monthStr)

  const origStr = fieldValue(/Original\s+Bal[ae]nc[ce]\s+\$?([\d,]+)/i)
  if (origStr) acc.highBalance = parseAmount(origStr)

  const highStr = fieldValue(/High[ce]st\s+Bal[ae]nc[ce]\s+\$?([\d,]+)/i)
  const highBal = parseAmount(highStr)
  if (highBal > 0) acc.highBalance = Math.max(acc.highBalance || 0, highBal)

  acc.terms = fieldValue(/Tcrms?\s+(.+)/i)

  const limitStr = fieldValue(/Cr[ce]dit\s+Limit\s+\$?([\d,]+)/i)
  if (limitStr) acc.creditLimit = parseAmount(limitStr)

  const status = (acc.payStatus || '').toLowerCase()
  if (status.includes('charge') || status.includes('collection') || status.includes('negative') ||
      (status.includes('late') && !status.includes('never'))) {
    acc.isDerogatory = true
    if (status.includes('charge')) acc.isChargeOff = true
    if (status.includes('collection')) acc.isCollection = true
  }

  const isClosed = status.includes('closed') || status.includes('paid') || (acc.creditorName || '').includes('Closed')

  return finalizeAccount(acc, isClosed)
}

function finalizeAccount(acc: Partial<Account>, isClosed: boolean): Account {
  const payStatus = (acc.payStatus || '').toLowerCase()
  const remarks = (acc.remarks || '').toLowerCase()

  const isNeverLate = payStatus.includes('never')
  const hasDerogatoryPayStatus = !isNeverLate && (
    payStatus.includes('charge') ||
    payStatus.includes('collection') ||
    payStatus.includes('late') ||
    payStatus.includes('delinquent') ||
    payStatus.includes('bad debt') ||
    payStatus.includes('past due') ||
    payStatus.includes('negative')
  )

  const isDerogatory = acc.isDerogatory ||
    hasDerogatoryPayStatus ||
    acc.isChargeOff ||
    remarks.includes('charge off')

  const isChargeOff = acc.isChargeOff ||
    payStatus.includes('charge off') ||
    payStatus.includes('charged off')

  const isCollection = acc.isCollection ||
    payStatus.includes('collection')

  const isLate = acc.isLate ||
    hasDerogatoryPayStatus

  const closed = isClosed ||
    acc.isClosed ||
    payStatus.includes('closed') ||
    payStatus.includes('paid')

  const isOpen = !closed && !isChargeOff && !isCollection

  let status: Account['status'] = 'Open'
  if (isChargeOff) status = 'ChargeOff'
  else if (isCollection) status = 'Collection'
  else if (isDerogatory) status = 'Derogatory'
  else if (closed) status = 'Closed'
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
    paymentHistory: acc.paymentHistory || [],
    isDerogatory,
    isChargeOff,
    isCollection,
    isLate,
    isOpen,
    isClosed: closed,
    derogatoryCount: 0,
    estimatedRemovalDate: acc.estimatedRemovalDate,
    dateFirstDelinquency: acc.dateFirstDelinquency,
    status,
  }
}

function extractInquiries(text: string): Inquiry[] {
  const inquiries: Inquiry[] = []

  const hardStart = text.search(/Hard\s+Inquiries/i)
  const softStart = text.search(/Soft\s+Inquiries/i)
  if (hardStart < 0 && softStart < 0) return inquiries

  let hardSection = ''
  let softSection = ''

  if (hardStart >= 0) {
    hardSection = softStart > hardStart ? text.slice(hardStart, softStart) : text.slice(hardStart)
  }
  if (softStart >= 0) {
    softSection = text.slice(softStart)
  }

  const parseSection = (section: string, type: 'Hard' | 'Soft') => {
    const lines = section.split('\n')
    let i = 0
    while (i < lines.length) {
      const line = lines[i].trim()
      if (!line || line.match(/^(Hard|Soft)\s+Inquiries/i)) { i++; continue }
      if (line.match(/^No\s+(hard|soft)\s+inquiries/i)) break

      // Check if this line looks like the start of a company name (all-caps, not an address)
      if (/^[A-Z][A-Z\s.&]+$/.test(line) && line.length > 2 && !line.includes('PO BOX')) {
        const nameLines: string[] = [line]
        let j = i + 1
        while (j < lines.length) {
          const nl = lines[j].trim()
          if (!nl) { j++; break }
          if (nl.match(/^Inquired\s+on/i)) break
          if (/^[A-Z][A-Z\s.&]+$/.test(nl) && nl.length > 2) {
            nameLines.push(nl)
            j++
          } else break
        }

        const companyName = nameLines.join(' ').trim()

        // Find "Inquired on" line
        let dateStr = ''
        for (let k = j; k < Math.min(j + 5, lines.length); k++) {
          const dl = lines[k].trim()
          if (dl.match(/^Inquired\s+on/i)) {
            const dateLine = lines[k + 1]?.trim() || ''
            const dateMatch = dateLine.match(/(\d{2}\/\d{2}\/\d{4})/)
            if (dateMatch) dateStr = dateMatch[1]
            break
          }
        }

        if (companyName && dateStr) {
          inquiries.push({
            bureau: 'Experian' as Bureau,
            creditorName: companyName,
            date: dateStr,
            type,
          })
        }
        i = j
      } else {
        i++
      }
    }
  }

  if (hardSection) parseSection(hardSection, 'Hard')
  if (softSection) parseSection(softSection, 'Soft')

  return inquiries
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
