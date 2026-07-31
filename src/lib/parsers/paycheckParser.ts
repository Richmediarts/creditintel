export interface ParsedPaycheck {
  company?: string
  employee_id?: string
  employee_name?: string
  pay_period_begin?: string
  pay_period_end?: string
  check_date?: string
  check_number?: string
  state_name?: string
  federal_filing_status?: string
  state_filing_status?: string
  bank_name?: string
  account_number?: string
  bank2_name?: string
  account2_number?: string
  hours_worked?: number
  gross_pay?: number
  pre_tax_deductions?: number
  employee_taxes?: number
  post_tax_deductions?: number
  net_pay?: number
  salary?: number
  biometric_credit?: number
  floating_holiday?: number
  holiday_pay?: number
  vacation_pay?: number
  group_term_life?: number
  spousal_biometric?: number
  oasdi?: number
  medicare?: number
  federal_tax?: number
  state_tax?: number
  social_security?: number
  retirement_401k?: number
  add_insurance?: number
  dental_plan?: number
  eye_plan?: number
  health_care_fsa?: number
  health_insurance?: number
  optional_life?: number
  hsa?: number
  loan_repayment?: number
  dependent_life?: number
  stock_purchase?: number
  spousal_life?: number
  employer_match?: number
  employer_hsa?: number
  deposit_amount?: number
  deposit2_amount?: number
  gross_pay_ytd?: number
  pre_tax_deductions_ytd?: number
  employee_taxes_ytd?: number
  post_tax_deductions_ytd?: number
  net_pay_ytd?: number
  hours_worked_ytd?: number
  salary_ytd?: number
  vacation_pay_ytd?: number
  biometric_credit_ytd?: number
  spousal_biometric_ytd?: number
  group_term_life_ytd?: number
  floating_holiday_ytd?: number
  holiday_pay_ytd?: number
  retirement_401k_ytd?: number
  health_insurance_ytd?: number
  dental_plan_ytd?: number
  eye_plan_ytd?: number
  health_care_fsa_ytd?: number
  optional_life_ytd?: number
  add_insurance_ytd?: number
  hsa_ytd?: number
  federal_tax_ytd?: number
  state_tax_ytd?: number
  oasdi_ytd?: number
  medicare_ytd?: number
  loan_repayment_ytd?: number
  dependent_life_ytd?: number
  stock_purchase_ytd?: number
  spousal_life_ytd?: number
  employer_match_ytd?: number
  employer_hsa_ytd?: number
  [key: string]: string | number | undefined
}

function extractMoney(s: string): number | null {
  const cleaned = s.trim().replace(/[$,]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function parseDate(s: string): string | null {
  const trimmed = s.trim()
  const formats = [/^(\d{2})\/(\d{2})\/(\d{4})$/, /^(\d{4})-(\d{2})-(\d{2})$/, /^(\d{2})-(\d{2})-(\d{4})$/]
  for (const fmt of formats) {
    const m = trimmed.match(fmt)
    if (m) {
      if (fmt === formats[0]) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
      if (fmt === formats[1]) return `${m[1]}-${m[2]}-${m[3]}`
      if (fmt === formats[2]) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
    }
  }
  return null
}

function getValueAfterLabel(line: string, label: string, ytd = false): number | null {
  const idx = line.toLowerCase().indexOf(label)
  if (idx === -1) return null
  const afterLabel = line.slice(idx + label.length)
  const matches = afterLabel.match(/([\d,]+\.\d{2})/g)
  if (!matches || matches.length === 0) return null
  const ytdIdx = ytd ? 1 : 0
  return ytdIdx < matches.length ? extractMoney(matches[ytdIdx]) : extractMoney(matches[0])
}

export function parsePaycheckText(rawText: string): ParsedPaycheck {
  const result: ParsedPaycheck = {}
  const lines = rawText.split('\n')

  for (const line of lines) {
    const lower = line.toLowerCase()

    if (lower.includes('voyix')) result.company = 'NCR Voyix Corporation'

    const empId = line.match(/\b(\d{10,11})\b/)
    if (empId && !result.employee_id) result.employee_id = empId[1]

    const dates = line.match(/(\d{2}\/\d{2}\/\d{4})/g)
    if (dates && dates.length >= 2) {
      const beginDate = parseDate(dates[0])
      const endDate = parseDate(dates[1])
      if (beginDate && !result.pay_period_begin) result.pay_period_begin = beginDate
      if (endDate && !result.pay_period_end) result.pay_period_end = endDate
    }
    if (dates && dates.length >= 3 && !result.check_date) {
      const cd = parseDate(dates[2])
      if (cd) result.check_date = cd
    }
  }

  for (const line of lines) {
    const lower = line.toLowerCase()
    const words = line.split(/\s+/)
    if (lower.includes('richard') || lower.includes('johnson')) {
      const nameWords: string[] = []
      for (const word of words) {
        if (word[0] && word[0].toUpperCase() === word[0] && word.length > 2 && !/\d/.test(word)) {
          const wl = word.toLowerCase()
          if (wl !== 'voyix' && wl !== 'corporation' && !['Name', 'Company', 'Employee', 'Description', 'Amount', 'Current', 'YTD', 'Hours', 'Gross', 'Tax', 'Net'].includes(word)) {
            nameWords.push(word)
            if (nameWords.length >= 2) break
          }
        }
      }
      if (nameWords.length > 0) result.employee_name = nameWords.join(' ')
    }
  }

  let summaryLine: string | null = null
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (lower.includes('current') && /\b\d{2}\.\d{2}\b/.test(line) && !lower.trim().startsWith('hours worked')) {
      const moneyMatches = line.match(/([\d,]+\.\d{2})/g)
      if (moneyMatches && moneyMatches.length >= 5) {
        summaryLine = line
        break
      }
    }
  }

  if (summaryLine) {
    const moneyMatches = summaryLine.match(/([\d,]+\.\d{2})/g)
    if (moneyMatches && moneyMatches.length >= 6) {
      result.hours_worked = extractMoney(moneyMatches[0]) ?? 0
      result.gross_pay = extractMoney(moneyMatches[1]) ?? 0
      result.pre_tax_deductions = extractMoney(moneyMatches[2]) ?? 0
      result.employee_taxes = extractMoney(moneyMatches[3]) ?? 0
      result.post_tax_deductions = extractMoney(moneyMatches[4]) ?? 0
      result.net_pay = extractMoney(moneyMatches[5]) ?? 0
    }
  }

  let ytdLine: string | null = null
  for (const line of lines) {
    if (/^\s*YTD/i.test(line) && line.toLowerCase().includes('ytd')) {
      const moneyMatches = line.match(/([\d,]+\.\d{2})/g)
      if (moneyMatches && moneyMatches.length >= 5) {
        ytdLine = line
        break
      }
    }
  }

  if (ytdLine) {
    const moneyMatches = ytdLine.match(/([\d,]+\.\d{2})/g)
    if (moneyMatches && moneyMatches.length >= 6) {
      result.hours_worked_ytd = extractMoney(moneyMatches[0]) ?? 0
      result.gross_pay_ytd = extractMoney(moneyMatches[1]) ?? 0
      result.pre_tax_deductions_ytd = extractMoney(moneyMatches[2]) ?? 0
      result.employee_taxes_ytd = extractMoney(moneyMatches[3]) ?? 0
      result.post_tax_deductions_ytd = extractMoney(moneyMatches[4]) ?? 0
      result.net_pay_ytd = extractMoney(moneyMatches[5]) ?? 0
    }
  }

  const lineChecks: [RegExp, Record<string, string | boolean>][] = [
    [/401k savings plan/i, { retirement_401k: '401k', retirement_401k_ytd: '401k' }],
    [/medical.*(?:plan|ins)/i, { health_insurance: 'medical', health_insurance_ytd: 'medical' }],
    [/dental plan/i, { dental_plan: 'dental', dental_plan_ytd: 'dental' }],
    [/eye plan/i, { eye_plan: 'eye', eye_plan_ytd: 'eye' }],
    [/health care fsa/i, { health_care_fsa: 'fsa', health_care_fsa_ytd: 'fsa' }],
    [/optional life/i, { optional_life: 'optional life', optional_life_ytd: 'optional life' }],
    [/add insurance/i, { add_insurance: 'add', add_insurance_ytd: 'add' }],
    [/federal withholding/i, { federal_tax: 'federal withholding', federal_tax_ytd: 'federal withholding' }],
    [/(?:state tax|ga withholding|withholding|ga)/i, { state_tax: 'withholding', state_tax_ytd: 'withholding' }],
    [/oasdi/i, { oasdi: 'oasdi', oasdi_ytd: 'oasdi' }],
    [/medicare/i, { medicare: 'medicare', medicare_ytd: 'medicare' }],
    [/401k.*employer.*match/i, { employer_match: 'match', employer_match_ytd: 'match' }],
    [/hsa.*employee/i, { hsa: 'hsa', hsa_ytd: 'hsa' }],
    [/hsa.*employer/i, { employer_hsa: 'hsa', employer_hsa_ytd: 'hsa' }],
    [/(?:loan repayment|401k loan)/i, { loan_repayment: 'loan', loan_repayment_ytd: 'loan' }],
    [/dependent life/i, { dependent_life: 'dependent life', dependent_life_ytd: 'dependent life' }],
    [/(?:stock purchase|employee stock)/i, { stock_purchase: 'stock', stock_purchase_ytd: 'stock' }],
    [/spousal life/i, { spousal_life: 'spousal life', spousal_life_ytd: 'spousal life' }],
    [/biometric credit/i, { biometric_credit: 'biometric', biometric_credit_ytd: 'biometric' }],
    [/spousal biometric credit/i, { spousal_biometric: 'spousal biometric', spousal_biometric_ytd: 'spousal biometric' }],
    [/group term life/i, { group_term_life: 'group term', group_term_life_ytd: 'group term' }],
    [/floating holiday/i, { floating_holiday: 'floating holiday', floating_holiday_ytd: 'floating holiday' }],
    [/^holiday\b/i, { holiday_pay: 'holiday', holiday_pay_ytd: 'holiday' }],
    [/^vacation\s/i, { vacation_pay: 'vacation', vacation_pay_ytd: 'vacation' }],
    [/^salary\s/i, { salary: 'salary', salary_ytd: 'salary' }],
  ]

  for (const line of lines) {
    for (const [regex, fields] of lineChecks) {
      if (regex.test(line)) {
        for (const [field, label] of Object.entries(fields)) {
          if (typeof label === 'string') {
            const isYtd = field.endsWith('_ytd')
            const val = getValueAfterLabel(line, label, isYtd)
            if (val !== null) (result as Record<string, unknown>)[field] = val
          }
        }
      }
    }

    if (/pnc/i.test(line)) {
      result.bank_name = 'PNC Bank'
      const depositVal = getValueAfterLabel(line, 'pnc')
      if (depositVal) result.deposit_amount = depositVal
    }
    if (/first tech|firsttech/i.test(line)) {
      result.bank2_name = 'First Tech Federal Credit Union'
      const depositVal = getValueAfterLabel(line, 'first') || getValueAfterLabel(line, 'tech')
      if (depositVal) result.deposit2_amount = depositVal
    }
    const accMatch = line.match(/\*{6}(\d{4})/)
    if (accMatch) {
      if (result.bank_name === 'PNC Bank' && !result.account_number) {
        result.account_number = '****' + accMatch[1]
      } else if (result.bank2_name && !result.account2_number) {
        result.account2_number = '****' + accMatch[1]
      }
    }
  }

  if (!result.account_number) {
    for (const line of lines) {
      const accMatch = line.match(/\*+(\d{4})/)
      if (accMatch && !result.account_number) {
        result.account_number = '****' + accMatch[1]
      }
    }
  }

  return result
}

export interface ParsedTransaction {
  date: string
  description: string
  amount: number
  balance: number
}

export function parseCsvTransactions(content: string): ParsedTransaction[] {
  const lines = content.split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const dateIdx = headers.findIndex(h => h === 'date' || h === 'posting date' || h === 'transaction date')
  const descIdx = headers.findIndex(h => h === 'description' || h === 'transaction description' || h === 'memo')
  const amountIdx = headers.findIndex(h => h === 'amount' || h === 'transaction amount')
  const balanceIdx = headers.findIndex(h => h === 'balance')

  if (dateIdx === -1 || amountIdx === -1) return []

  const transactions: ParsedTransaction[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))
    const date = cols[dateIdx] || ''
    const desc = descIdx >= 0 ? cols[descIdx] || '' : ''
    const amountStr = (cols[amountIdx] || '0').replace(/[$,\s]/g, '')
    const balanceStr = balanceIdx >= 0 ? (cols[balanceIdx] || '0').replace(/[$,\s]/g, '') : '0'

    const amount = parseFloat(amountStr) || 0
    const balance = parseFloat(balanceStr) || 0

    if (date && amount !== 0) {
      transactions.push({ date, description: desc, amount, balance })
    }
  }

  return transactions
}

export function parsePdfTransactions(text: string): ParsedTransaction[] {
  const lines = text.split('\n')
  const datePattern = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/
  const transactions: ParsedTransaction[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const dm = datePattern.exec(line)
    if (!dm) continue

    const amounts = line.match(/[-]?\$?[\d,]+\.\d{2}/g)
    if (!amounts || amounts.length === 0) continue

    const nums = amounts.map(a => parseFloat(a.replace(/[$,\s]/g, ''))).filter(n => !isNaN(n))
    if (nums.length === 0) continue

    let amount = nums[0]
    const balance = nums.length > 1 ? nums[nums.length - 1] : 0

    const lower = line.toLowerCase()
    if (lower.includes('credit') || lower.includes('deposit')) {
      if (amount < 0) amount = Math.abs(amount)
    } else if (lower.includes('debit') || lower.includes('withdrawal')) {
      if (amount > 0) amount = -amount
    }

    let desc = line.slice(0, dm.index).trim() + ' ' + line.slice(dm.index + dm[0].length).trim()
    for (const a of amounts) {
      desc = desc.replace(a, '').replace(/[$]/g, '').trim()
    }
    desc = desc.replace(/\s+/g, ' ').trim()

    let dateRaw = dm[1].replace(/-/g, '/')
    const parts = dateRaw.split('/')
    if (parts[0].length === 4) {
      dateRaw = `${parts[1]}/${parts[2]}/${parts[0]}`
    }

    transactions.push({
      date: dateRaw,
      description: desc.slice(0, 100) || 'Unknown',
      amount,
      balance,
    })
  }

  return transactions
}
