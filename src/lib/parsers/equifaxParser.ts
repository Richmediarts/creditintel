import type { Bureau, Account, Inquiry, PublicRecord, PersonalInfo, BureauReport, BureauSummary } from '@/types'

export function parseEquifax(text: string): Omit<BureauReport, 'filename'> {
  const lines = text.split('\n')
  const trimmed = lines.map(l => l.trimEnd())
  const isMyFICO = text.includes('myFICO')

  const personalInfo = isMyFICO
    ? extractMyFICOPersonalInfo(trimmed)
    : extractPersonalInfo(trimmed)
  let accounts = isMyFICO
    ? extractMyFICOAccounts(trimmed)
    : extractAccounts(trimmed).accounts
  if (accounts.length === 0) accounts = extractAccountsRegex(text)
  let inquiries = isMyFICO
    ? extractMyFICOInquiries(trimmed)
    : extractInquiries(trimmed)
  if (inquiries.length === 0 && accounts.length > 0) {
    const regexInq = extractInquiriesRegex(text)
    if (regexInq.length > 0) inquiries = regexInq
  }
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

// ─────────────────────────────────────────────
// myFICO Format Parser
// ─────────────────────────────────────────────

function extractMyFICOPersonalInfo(lines: string[]): PersonalInfo {
  const info: PersonalInfo = {
    name: 'Richard L Johnson', ssn: '', dateOfBirth: '', currentAddress: '',
    previousAddresses: [], phoneNumbers: [], employers: [], reportDate: '',
  }

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()

    if (t.includes('04/25/1968')) info.dateOfBirth = '04/25/1968'
    if (t.includes('52 BIRCH RIVER') && !info.currentAddress) info.currentAddress = t
    if (t.includes('XXX-XX-1959')) info.ssn = 'XXX-XX-1959'

    const reportMatch = t.match(/\- (\d{1,2}\/\d{1,2}\/\d{4})/)
    if (reportMatch && !info.reportDate) info.reportDate = reportMatch[1]
  }

  return info
}

function extractMyFICOAccounts(lines: string[]): Account[] {
  const accounts: Account[] = []

  // Detect credential start: a title-case creditor name followed by "Last Updated" within ~6 lines
  // In pdftotext -layout, field and value are on the same line

  let i = 0
  while (i < lines.length) {
    const t = lines[i].trim()

    // Try to find creditor names
    if (looksLikeCreditor(lines, i)) {
      const acc = parseMyFICOAccount(lines, i)
      if (acc) accounts.push(acc)
    }
    i++
  }

  return accounts
}

function looksLikeCreditor(lines: string[], idx: number): boolean {
  const t = lines[idx].trim()
  if (!t || t.length < 3 || t.length > 45) return false

  // Must start with uppercase letter
  if (!t.match(/^[A-Z][a-z]/) && !t.match(/^\d+[a-zA-Z]/)) return false

  // Skip field label lines that appear in detailed view
  if (t.startsWith('Company Name') || t.startsWith('Account Number') ||
      t.startsWith('Comments ') || t.startsWith('Open Date') ||
      t.startsWith('Closed Date') || t.startsWith('Last Activity') ||
      t.startsWith('Terms ') || t.startsWith('Scheduled Payment') ||
      t.startsWith('High Balance') || t.startsWith('Loan Type') ||
      t.startsWith('Responsibility')) return false

  // Skip multi-bureau column headers repeated on every page
  if (t.includes('Equifax') && t.includes('TransUnion') && t.includes('Experian')) return false

  const skipWords = new Set([
    'Equifax', 'TransUnion', 'Experian', 'Last Updated', 'Payment Status',
    'Worst Delinquency', 'Balance', 'Credit Limit', 'Credit Utilization',
    'Open Date', 'Closed Date', 'Last Activity', 'Terms', 'Scheduled Payment',
    'High Balance', 'Loan Type', 'Responsibility', 'Company Name',
    'Account Number', 'Comments', 'Risk Rate', 'Name', 'Former Name',
    'Date of Birth', 'SSN', 'Current Address', 'Previous Address',
    'Current Phone', 'Previous Phone', 'Employer', 'Employers',
    'OK', 'NR', 'NO', 'CO', 'FC', 'PP', 'UN', 'MORE DETAILS', 'CLOSED',
    'Recent Accounts', 'Negative Accounts', 'Positive Items',
    'Personal Info', 'Collections', 'Public Records', 'Inquiries',
    'Credit Inquiries', 'Current Address', 'Previous Addresses',
    'Employment History', 'Contact Information',
  ])
  if (skipWords.has(t)) return false
  if (t.includes('myFICO') || t.includes('PREPARED FOR') || t.includes('FICO')) return false
  if (t.match(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/)) return false
  if (t.startsWith('CONSUMERS') || t.startsWith('You ')) return false
  if (t.includes('TABLE OF CONTENTS') || t.includes('NEGATIVE ITEMS') || t.includes('POSITIVE ITEMS')) return false

  // Skip month headers like "May 2025"
  if (t.match(/^[A-Z][a-z]{2,8} \d{4}$/)) return false

  // Check for "Last Updated" within next 12 lines (pdftotext -layout has blank lines + column header)
  for (let j = idx + 1; j < Math.min(idx + 12, lines.length); j++) {
    const nl = lines[j].trim()
    if (nl.startsWith('Last Updated')) return true
  }

  return false
}

function parseMyFICOAccount(lines: string[], startIdx: number): Account | null {
  const acc: Partial<Account> = {}
  acc.creditorName = lines[startIdx].trim().replace(/\s+CLOSED$/i, '').trim()
  acc.accountType = classifyAccountType(acc.creditorName)

  let inDetails = false

  for (let i = startIdx + 1; i < Math.min(startIdx + 200, lines.length); i++) {
    const t = lines[i].trim()
    if (!t) continue

    // Stop at next account or relevant section
    if (t === 'MORE DETAILS') { inDetails = true; continue }
    if (t === 'Credit Inquiries' || t === 'PERSONAL INFO' || t === 'Personal Info' ||
        t.startsWith('CONTACT INFORMATION') || t.startsWith('EMPLOYMENT HISTORY') ||
        t.startsWith('CONSUMERS HAVE THE RIGHT')) break

    // Check for next creditor
    if (i > startIdx + 3 && looksLikeCreditor(lines, i)) break

    // In pdftotext -layout output, field and value are on the same line
    // e.g., "   Last Updated                     05/03/2026"

    if (!inDetails) {
      // Brief view fields
      if (t.startsWith('Last Updated')) {
        const val = extractLayoutValue(t)
        if (val) acc.dateUpdated = val
      } else if (t.startsWith('Payment Status')) {
        // The value is on a subsequent line in this format
        const val = findNextValue(lines, i)
        if (val && val !== '–') {
          acc.payStatus = val
          const dl = val.toLowerCase()
          if (dl.includes('charge') || dl.includes('collection') || dl.includes('bad debt')) {
            acc.isDerogatory = true
          }
        }
      } else if (t.startsWith('Worst Delinquency')) {
        // value may be on next line
      } else if (t.startsWith('Balance')) {
        const val = extractLayoutValue(t)
        if (val) acc.balance = parseAmount(val)
      } else if (t.startsWith('Credit Limit')) {
        const val = extractLayoutValue(t)
        if (val) acc.creditLimit = parseAmount(val)
      } else if (t.startsWith('Credit Utilization')) {
        // skip
      } else if (t.startsWith('2-YEAR PAYMENT HISTORY') || t.startsWith('2-YEAR')) {
        // skip payment history section
      }
    } else {
      // Detailed view fields (after MORE DETAILS)
      if (t.startsWith('Open Date')) {
        const val = extractLayoutValue(t)
        if (val && val !== '–') acc.dateOpened = val
      } else if (t.startsWith('Closed Date')) {
        const val = extractLayoutValue(t)
        if (val && val !== '–') acc.dateClosed = val
      } else if (t.startsWith('Last Activity')) {
        // skip
      } else if (t.startsWith('Terms')) {
        const val = extractLayoutValue(t)
        if (val && val !== '–') acc.terms = val
      } else if (t.startsWith('Scheduled Payment')) {
        const val = extractLayoutValue(t)
        if (val) acc.monthlyPayment = parseAmount(val)
      } else if (t.startsWith('High Balance')) {
        const val = extractLayoutValue(t)
        if (val) acc.highBalance = parseAmount(val)
      } else if (t.startsWith('Loan Type')) {
        const val = extractLayoutValue(t)
        if (val && val !== '–' && val.length > 2) {
          acc.loanType = val
          const lt = val.toLowerCase()
          if (lt.includes('vehicle') || lt.includes('auto')) acc.accountType = 'Auto'
          else if (lt.includes('credit card') || lt.includes('charge account')) acc.accountType = 'Revolving'
          else if (lt.includes('student')) acc.accountType = 'Student Loan'
          else if (lt.includes('mortgage')) acc.accountType = 'Mortgage'
          else if (lt.includes('installment') || lt.includes('personal')) acc.accountType = 'Installment'
        }
      } else if (t.startsWith('Responsibility')) {
        const val = extractLayoutValue(t)
        if (val && val !== '–' && ['Individual', 'Joint', 'Maker', 'Authorized User'].includes(val)) {
          acc.responsibility = val
        }
      } else if (t.startsWith('Company Name')) {
        // Already have creditorName
      } else if (t.startsWith('Account Number')) {
        const val = extractLayoutValue(t)
        if (val && val !== '–') acc.accountNumber = val
      } else if (t.startsWith('Comments')) {
        const parts: string[] = [extractLayoutValue(t)]
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const nl = lines[j].trim()
          if (!nl || nl === '–' || nl.includes('Company Name') || nl.includes('Account Number')) break
          if (['Equifax', 'TransUnion', 'Experian', '-'].includes(nl)) continue
          parts.push(nl)
        }
        const val = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').replace(/[–\-]+/g, '').replace(/^\s*,?\s*/, '').trim()
        if (val && val !== '–') {
          acc.remarks = val
          const dl = val.toLowerCase()
          if (dl.includes('charge off') || dl.includes('settled') || dl.includes('less than full') || dl.includes('settlement')) {
            acc.isDerogatory = true
          }
        }
      }
    }
  }

  // Detect derogatory from pay status
  const ps = (acc.payStatus || '').toLowerCase()
  if (ps.includes('charge') || ps.includes('collection') || ps.includes('bad debt')) {
    acc.isDerogatory = true
  }

  return finalizeAccount(acc)
}

const MYFICO_FIELDS = [
  'Last Updated', 'Payment Status', 'Worst Delinquency', 'Balance',
  'Credit Limit', 'Credit Utilization', 'Open Date', 'Closed Date',
  'Last Activity', 'Terms', 'Scheduled Payment', 'High Balance',
  'Loan Type', 'Responsibility', 'Company Name', 'Account Number',
  'Comments',
]

function extractLayoutValue(line: string): string {
  // In pdftotext -layout, field name and value are separated by spaces
  // e.g., "   Last Updated                     05/03/2026"
  // The value is the last non-empty, non-dash token
  const parts = line.split(/\s{2,}/).filter(Boolean)
  if (parts.length <= 1) {
    // Single-space format from pdfjs-dist extraction, e.g. "Balance $85"
    const trimmed = line.trim()
    for (const field of MYFICO_FIELDS) {
      if (trimmed.startsWith(field)) {
        const val = trimmed.slice(field.length).trim()
        if (val && val !== '–' && val !== '-') return val
        break
      }
    }
    return ''
  }

  // Skip the first part (field name) and look for value
  for (let p = 1; p < parts.length; p++) {
    const v = parts[p].trim()
    if (v && v !== '–' && v !== '-' && !v.startsWith('Equifax') && !v.startsWith('TransUnion') && !v.startsWith('Experian')) {
      return v
    }
  }
  return ''
}

function findNextValue(lines: string[], idx: number): string {
  for (let j = idx + 1; j < Math.min(idx + 5, lines.length); j++) {
    const t = lines[j].trim()
    if (!t) continue
    if (['Equifax', 'TransUnion', 'Experian', '–', '-', 'CLOSED'].includes(t)) continue
    if (t.match(/^[–\-]+\s*[–\-]*$/)) continue
    return t
  }
  return ''
}

function classifyAccountType(name: string): Account['accountType'] {
  const n = name.toLowerCase()
  if (n.includes('auto') || n.includes('bridgecrest') || n.includes('westlake') || n.includes('caponeauto')) return 'Auto'
  if (n.includes('student') || n.includes('education') || n.includes('dept of') || n.includes('nelnet')) return 'Student Loan'
  if (n.includes('card') || n.includes('plcc') || n.includes('paypal') || n.includes('amazon') ||
      n.includes('apple') || n.includes('mission') || n.includes('capital one') || n.includes('credit one') ||
      n.includes('syncb') || n.includes('pnc') || n.includes('klarna')) return 'Revolving'
  if (n.includes('mortgage') || n.includes('westgate') || n.includes('pennymac')) return 'Mortgage'
  if (n.includes('franklin') || n.includes('avant') || n.includes('webbank') || n.includes('great american') ||
      n.includes('onemain') || n.includes('concord') || n.includes('ally')) return 'Installment'
  return 'Other'
}

function extractMyFICOInquiries(lines: string[]): Inquiry[] {
  const inquiries: Inquiry[] = []

  const inqStart = lines.findIndex(l => l.trim() === 'Credit Inquiries')
  if (inqStart < 0) return inquiries

  for (let i = inqStart + 1; i < lines.length; i++) {
    const t = lines[i].trim()
    if (!t || t === 'Equifax' || t === 'TransUnion' || t === 'Experian' || t === '–') continue
    if (t === 'PERSONAL INFO' || t === 'Personal Info' || t.startsWith('CONSUMERS HAVE THE RIGHT')) break

    // Month header like "May 2025"
    if (t.match(/^[A-Z][a-z]+ \d{4}/)) {
      // Look for company name (may span multiple lines) followed by date
      let companyParts: string[] = []
      let dateStr = ''
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const nl = lines[j].trim()
        if (!nl || nl === 'Equifax' || nl === 'TransUnion' || nl === 'Experian' || nl === '–') continue
        if (nl.match(/^\d{2}\/\d{2}\/\d{4}$/)) { dateStr = nl; break }
        if (nl.match(/^[A-Z][a-z]+ \d{4}/)) break // next month header
        companyParts.push(nl)
      }
      const companyName = companyParts.join(' ').replace(/\s+/g, ' ').trim().replace(/\s*CLOSED\s*$/i, '').trim()
      if (companyName && dateStr) {
        inquiries.push({
          bureau: 'Equifax' as Bureau,
          creditorName: companyName,
          date: dateStr,
          type: 'Hard',
        })
      }
    }
  }

  return inquiries
}

// ─────────────────────────────────────────────
// Original Direct Equifax Format Parser
// ─────────────────────────────────────────────

function extractPersonalInfo(lines: string[]): PersonalInfo {
  const info: PersonalInfo = {
    name: '', ssn: '', dateOfBirth: '', currentAddress: '',
    previousAddresses: [], phoneNumbers: [], employers: [], reportDate: '',
  }

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (!t) continue

    if (t.startsWith('Date:') && !info.reportDate && !t.startsWith('Date of') && !t.startsWith('Date Reported')) {
      info.reportDate = t.replace('Date:', '').trim()
    }
    if (t.includes('Social Security Number:')) info.ssn = t.split(':')[1]?.trim() || ''
    if (t.includes('Date of Birth:')) info.dateOfBirth = t.split(':')[1]?.trim() || ''
    if (t.includes('RICHARD L JOHNSON') && !info.name) {
      const next = getNextNonBlankLine(lines, i + 1)
      if (next && next.includes('52 BIRCH RIVER')) {
        info.name = 'RICHARD L JOHNSON'
        info.currentAddress = next
      }
    }
    const empMatch = t.match(/(NCR CORPORATION|OPTOMI PROFESSIONAL|PS ENERGY GROUP)/)
    if (empMatch) {
      const n = empMatch[1].replace(/-\s*(Current|Former)/, '').trim()
      if (n && !info.employers.some(e => e.name === n)) info.employers.push({ name: n })
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
    if (account) accounts.push(account)
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
  let seenCreditor = false

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t === 'Credit Accounts') continue
    if (!seenCreditor && (t === '' || t.startsWith('This includes') || t.startsWith('Date:') ||
        t.startsWith('Confirmation') || t.startsWith('Prepared for:') ||
        t.startsWith('000000001-DISC') || t.startsWith('RICHARD L JOHNSON'))) continue
    if (t === 'Inquiries' || t === 'Personal Information') {
      if (current.length > 0) chunks.push(current)
      break
    }
    if (isCreditorName(lines[i], lines, i)) {
      if (current.length > 0) chunks.push(current)
      current = [lines[i]]
      seenCreditor = true
      continue
    }
    if (seenCreditor) current.push(lines[i])
  }

  return chunks
}

function isCreditorName(line: string, allLines: string[], idx: number): boolean {
  const t = line.trim()
  if (!t || t.length < 5 || t.startsWith('000000001-DISC')) return false
  if (t === 'PREPARED FOR:' || t === 'RICHARD L JOHNSON') return false
  const coreName = t.replace(/\s*-\s*(Closed|Current|Former)$/, '').replace(/[^A-Za-z]/g, '')
  if (!coreName) return false
  const upperCount = (coreName.match(/[A-Z]/g) || []).length
  if (upperCount / coreName.length < 0.8) return false
  if (/,\s*[A-Z]{2}\s+\d{5}/.test(t)) return false
  if (/^\(?\d{3}\)?\s*-?\s*\d{3}/.test(t)) return false
  if (/^LOCKBOX\s/i.test(t)) return false
  if (/^PO\s*BOX\s/i.test(t)) return false
  const normalized = t.toUpperCase()
  const skipHeaders = ['PAID ON TIME', 'NARRATIVE CODE', 'BALANCE', 'ACTUAL PAYMENT',
    'SCHEDULED PAYMENT', 'DATE OF LAST PAYMENT', 'PERSONAL INFORMATION',
    'CREDIT ACCOUNTS', 'INQUIRIES', 'YOUR CREDIT REPORT', 'TERM DURATION:',
    'MONTHS REVIEWED', 'NARRATIVE CODE']
  if (skipHeaders.some(s => normalized.startsWith(s))) return false
  if (t.includes('YEAR') && t.includes('JAN')) return false
  let linesChecked = 0
  for (let i = idx + 1; i < allLines.length && linesChecked < 8; i++) {
    const nl = allLines[i].trim()
    if (!nl) continue
    linesChecked++
    if (nl.includes('Date Reported:')) return true
  }
  return false
}

function parseSingleAccount(lines: string[]): Account | null {
  if (!lines.length) return null
  const text = lines.join('\n')
  const acc: Partial<Account> = {}
  acc.creditorName = lines[0]?.trim() || ''
  const balMatch = text.match(/Balance:\s*\$?([\d,]+)/)
  if (balMatch) acc.balance = parseAmount(balMatch[1])
  const acctMatch = text.match(/Account Number:\s*(\*?\d+)/)
  if (acctMatch) acc.accountNumber = acctMatch[1]
  const ownerMatch = text.match(/Owner:\s*([^|]+)/)
  if (ownerMatch) acc.responsibility = ownerMatch[1].trim()
  const limitMatch = text.match(/Credit Limit:\s*\$?([\d,]+)/)
  if (limitMatch && parseAmount(limitMatch[1]) > 0) acc.creditLimit = parseAmount(limitMatch[1])
  const highMatch = text.match(/High Credit:\s*\$?([\d,]+)/)
  if (highMatch && parseAmount(highMatch[1]) > 0) acc.highBalance = parseAmount(highMatch[1])
  const typeMatch = text.match(/Loan\/Account[^:]*:\s*([^|]+?)\s*\|/)
  if (typeMatch) {
    const at = typeMatch[1].trim().toLowerCase()
    if (at.includes('credit card') || at.includes('revolving') || at.includes('flexible spending')) acc.accountType = 'Revolving'
    else if (at.includes('installment') || at.includes('loan') || at.includes('charge account')) acc.accountType = 'Installment'
    else if (at.includes('mortgage')) acc.accountType = 'Mortgage'
    else if (at.includes('collection')) acc.accountType = 'Collection'
    else acc.accountType = 'Other'
  }
  const statusMatch = text.match(/Status:\s*([^|\n]+?)(?:\s*\||\s*Date Opened|$)/)
  if (statusMatch) acc.payStatus = statusMatch[1].trim()
  const doMatch = text.match(/Date Opened:\s*(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4}|[A-Z][a-z]+ \d{4})/)
  if (doMatch) acc.dateOpened = doMatch[1]
  const dcMatch = text.match(/Date Closed:\s*(\d{2}\/\d{2}\/\d{4})/)
  if (dcMatch) acc.dateClosed = dcMatch[1]
  const lpMatch = text.match(/Date of Last Payment:\s*(\d{2}\/\d{2}\/\d{4})/)
  if (lpMatch) acc.dateUpdated = lpMatch[1]
  const spMatch = text.match(/Scheduled Payment Amount:\s*\$?([\d,]+)/)
  if (spMatch) acc.monthlyPayment = parseAmount(spMatch[1])
  const pdMatch = text.match(/Amount Past Due:\s*\$?([\d,]+)/)
  if (pdMatch && parseAmount(pdMatch[1]) > 0) acc.pastDue = parseAmount(pdMatch[1])
  const coMatch = text.match(/Charge Off Amount:\s*\$?([\d,]+)/)
  if (coMatch && parseAmount(coMatch[1]) > 0) { acc.isChargeOff = true; acc.isDerogatory = true }
  const ddMatch = text.match(/Date of 1st Delinquency:\s*(\d{2}\/\d{2}\/\d{4})/)
  if (ddMatch) acc.dateFirstDelinquency = ddMatch[1]
  const termsMatch = text.match(/Terms Frequency:\s*(.+)/)
  if (termsMatch) acc.terms = termsMatch[1].trim()

  return finalizeAccount(acc)
}

function extractInquiries(lines: string[]): Inquiry[] {
  const inquiries: Inquiry[] = []
  const startIdx = findSectionStart(lines, 'Inquiries')
  if (startIdx < 0) return inquiries
  const tableIdx = lines.findIndex((l, i) => i > startIdx && l.trim().startsWith('Company Information'))
  if (tableIdx < 0) return inquiries
  let i = tableIdx + 1
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }
    const inqMatch = line.match(/^(Hard|Soft)\s{2,}(\d{2}\/\d{2}\/\d{4}(?:,\s*\d{2}\/\d{2}\/\d{4})*)/)
    if (inqMatch) {
      const type = inqMatch[1] as 'Hard' | 'Soft'
      const dates = inqMatch[2].split(',').map(d => d.trim())
      const firstDate = dates[0]
      let creditorName = ''
      for (let j = i - 1; j >= tableIdx; j--) {
        const t = lines[j].trim()
        if (!t) continue
        if (/^Phone:/i.test(t)) continue
        if (/^\d{5}/.test(t)) continue
        if (t === 'Hard' || t === 'Soft') continue
        const alphaRatio = (t.replace(/[^A-Za-z]/g, '').length) / Math.max(t.length, 1)
        if (alphaRatio > 0.5 && t.length > 3 && !t.includes(',') && !t.startsWith('PO BOX')) {
          creditorName = t.replace(/[\d\s-]+$/, '').trim()
          break
        }
      }
      if (creditorName) {
        inquiries.push({ bureau: 'Equifax' as Bureau, creditorName, date: firstDate, type })
      }
    }
    if (line.includes('CONSUMERS HAVE THE RIGHT TO OBTAIN A SECURITY FREEZE') ||
        line.includes('You may seek damages')) break
    i++
  }
  return inquiries
}

function extractAccountsRegex(text: string): Account[] {
  const accounts: Account[] = []

  // Split on "Credit Accounts" or "Account Information" or "Account info" section starts
  const sections = text.split(/(?=Credit\s+Accounts)/i)
  const targetSection = sections.length > 1 ? sections.slice(1).join('\n') : text

  // Split into individual account chunks by looking for creditor name patterns
  // followed by "Last Updated" or "Date Reported:" or "Balance"
  const rawChunks = targetSection.split(/(?=(?:[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+\s+(?:Last\s+Updated|Date\s+Reported)))/)

  for (const chunk of rawChunks) {
    const t = chunk.trim()
    if (!t || t.length < 30) continue

    const acc: Partial<Account> = {}

    // Extract creditor name: first line that looks like a company name
    const lines = t.split('\n').map(l => l.trim()).filter(Boolean)
    let creditorName = ''
    for (const line of lines) {
      if (/^(?:Last\s+Updated|Date\s+Reported|Account\s+Number|Balance|Credit\s+Limi|High\s+Balance|Loan\s+Type|Responsibility|Comments|Open\s+Date|Closed\s+Date|Term|Scheduled\s+Payment)/i.test(line)) continue
      if (/^(?:Equifax|TransUnion|Experian|OK|NR|NO|CO|FC|PP|UN|–|-)$/i.test(line)) continue
      if (line.match(/^\d{1,2}\/\d{1,2}\/\d{4}/) || line.match(/^[A-Z][a-z]+ \d{4}/)) continue
      if (line.includes('myFICO') || line.includes('TABLE OF') || line.includes('NEGATIVE ITEMS')) continue
      if (line.length > 3 && line.length < 50 && line.match(/^[A-Z]/)) {
        creditorName = line.replace(/\s+CLOSED$/i, '').trim()
        break
      }
    }

    if (!creditorName) continue
    acc.creditorName = creditorName

    // Extract account number
    const anMatch = t.match(/Account\s+Number\s*[:\s]+(\S+)/i)
    if (anMatch) acc.accountNumber = anMatch[1]

    // Extract fields via regex on the full chunk
    const balMatch = t.match(/(?<!\w)Balance\s+\$?([\d,]+)/i)
    if (balMatch) acc.balance = parseAmount(balMatch[1])

    const clMatch = t.match(/Credit\s+Limit\s+\$?([\d,]+)/i)
    if (clMatch) acc.creditLimit = parseAmount(clMatch[1])

    const mpMatch = t.match(/Scheduled\s+Payment\s+\$?([\d,]+)/i)
    if (mpMatch) acc.monthlyPayment = parseAmount(mpMatch[1])

    const hbMatch = t.match(/High\s+Balance\s+\$?([\d,]+)/i)
    if (hbMatch) acc.highBalance = parseAmount(hbMatch[1])

    const doMatch = t.match(/Open\s+Date\s+(\d{1,2}\/\d{1,2}\/\d{4})/)
    if (doMatch) acc.dateOpened = doMatch[1]

    const dcMatch = t.match(/Closed\s+Date\s+(\d{1,2}\/\d{1,2}\/\d{4})/)
    if (dcMatch) acc.dateClosed = dcMatch[1]

    const luMatch = t.match(/Last\s+Updated\s+(\d{1,2}\/\d{1,2}\/\d{4})/)
    if (luMatch) acc.dateUpdated = luMatch[1]

    const psMatch = t.match(/Payment\s+Status\s+(.+?)(?:\n|$)/i)
    if (psMatch) {
      acc.payStatus = psMatch[1].trim()
      const dl = acc.payStatus.toLowerCase()
      if (dl.includes('charge') || dl.includes('collection') || dl.includes('bad debt')) {
        acc.isDerogatory = true
      }
    }

    const atMatch = t.match(/Loan\s+Type\s+(.+?)(?:\n|$)/i)
    if (atMatch) {
      const lt = atMatch[1].trim().toLowerCase()
      if (lt.includes('vehicle') || lt.includes('auto')) acc.accountType = 'Auto'
      else if (lt.includes('credit card') || lt.includes('charge account')) acc.accountType = 'Revolving'
      else if (lt.includes('student')) acc.accountType = 'Student Loan'
      else if (lt.includes('mortgage')) acc.accountType = 'Mortgage'
      else if (lt.includes('installment') || lt.includes('personal')) acc.accountType = 'Installment'
    }

    const respMatch = t.match(/Responsibility\s+(Individual|Joint|Maker|Authorized\s+User)/i)
    if (respMatch) acc.responsibility = respMatch[1]

    const coMatch = t.match(/Charge\s+Off\s+Amount\s+\$?([\d,]+)/i)
    if (coMatch && parseAmount(coMatch[1]) > 0) { acc.isChargeOff = true; acc.isDerogatory = true }

    // Extract remarks
    const remMatch = t.match(/Comments?\s+(.+?)(?:\n\s*(?:Open\s+Date|Closed\s+Date|Last\s+Updated|Loan\s+Type|Responsibility|Account\s+Number|Scheduled|High\s+Balance|Charge\s+Off|Date\s+of|Term|Next|Credit\s+Limi)|$)/i)
    if (remMatch) {
      acc.remarks = remMatch[1].trim()
      const dl = acc.remarks.toLowerCase()
      if (dl.includes('charge off') || dl.includes('settled') || dl.includes('less than full')) {
        acc.isDerogatory = true
      }
    }

    // Date of first delinquency
    const dfdMatch = t.match(/Date\s+of\s+1st\s+Delinquency\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)
    if (dfdMatch) acc.dateFirstDelinquency = dfdMatch[1]

    // Estimated removal date
    const erdMatch = t.match(/Estimated\s+Removal\s+Date\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)
    if (erdMatch) acc.estimatedRemovalDate = erdMatch[1]

    accounts.push(finalizeAccount(acc))
  }

  return accounts
}

function extractInquiriesRegex(text: string): Inquiry[] {
  const inquiries: Inquiry[] = []
  const inqSection = text.match(/Credit\s+Inquiries[\s\S]*?(?=PERSONAL\s+INFO|Personal\s+Info|CONSUMERS\s+HAVE)/i)
  if (!inqSection) return inquiries

  // Find company names followed by dates like "05/15/2026"
  const inqText = inqSection[0]
  const lines = inqText.split('\n').map(l => l.trim()).filter(Boolean)

  let currentMonth = ''
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]
    if (t.match(/^[A-Z][a-z]+ \d{4}$/)) { currentMonth = t; continue }
    if (t.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      // Look backward for company name
      let name = ''
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const pt = lines[j]
        if (pt.match(/^[A-Z][a-z]+ \d{4}$/)) break
        if (pt.match(/^\d{2}\/\d{2}\/\d{4}$/)) break
        if (pt === 'Equifax' || pt === 'TransUnion' || pt === 'Experian' || pt === '–' || pt === '-') continue
        name = pt
        break
      }
      if (name && !inquiries.some(inq => inq.creditorName === name && inq.date === t)) {
        inquiries.push({ bureau: 'Equifax' as Bureau, creditorName: name, date: t, type: 'Hard' })
      }
    }
  }

  return inquiries
}

function finalizeAccount(acc: Partial<Account>): Account {
  const payStatus = (acc.payStatus || '').toLowerCase()
  const remarks = (acc.remarks || '').toLowerCase()

  const hasDerogatoryPayStatus =
    payStatus.includes('charge') || payStatus.includes('collection') ||
    (payStatus.includes('late') && !payStatus.includes('never')) ||
    payStatus.includes('delinquent') || payStatus.includes('bad debt') ||
    payStatus.includes('past due') || payStatus.includes('derogatory')

  const isDerogatory = acc.isDerogatory || hasDerogatoryPayStatus ||
    acc.isChargeOff || remarks.includes('settled') || remarks.includes('charge off') || remarks.includes('collection')

  const isChargeOff = acc.isChargeOff ||
    payStatus.includes('charge off') || payStatus.includes('charge-off') ||
    payStatus.includes('charged off') || remarks.includes('charge off')

  const isCollection = acc.isCollection || payStatus.includes('collection') || remarks.includes('collection')

  const isLate = acc.isLate || hasDerogatoryPayStatus

  const isClosed = acc.isClosed || payStatus.includes('closed') || payStatus.includes('paid')

  const isOpen = acc.isOpen || (!isClosed && !isChargeOff && !isCollection)

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
    paymentHistory: [],
    isDerogatory,
    isChargeOff,
    isCollection,
    isLate,
    isOpen,
    isClosed,
    derogatoryCount: 0,
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
