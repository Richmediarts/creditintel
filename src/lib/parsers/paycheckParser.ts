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
  salary_hours?: number
  salary_rate?: number
  biometric_credit?: number
  biometric_credit_hours?: number
  biometric_credit_rate?: number
  floating_holiday?: number
  floating_holiday_hours?: number
  floating_holiday_rate?: number
  holiday_pay?: number
  holiday_pay_hours?: number
  holiday_pay_rate?: number
  vacation_pay?: number
  vacation_hours?: number
  vacation_rate?: number
  group_term_life?: number
  group_term_life_hours?: number
  group_term_life_rate?: number
  spousal_biometric?: number
  spousal_biometric_hours?: number
  spousal_biometric_rate?: number
  other_earnings?: number
  other_earnings_hours?: number
  other_earnings_rate?: number
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
  // MM/DD/YYYY
  let m = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  // YYYY-MM-DD
  m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  // MM-DD-YYYY
  m = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  // Month DD, YYYY
  m = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (m) {
    const monthNames: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
    }
    const monthNum = monthNames[m[1].toLowerCase()]
    if (monthNum) return `${m[3]}-${monthNum}-${m[2].padStart(2, '0')}`
  }
  return null
}

function getValueAfterLabel(line: string, label: string, ytd = false): number | null {
  const lineLower = line.toLowerCase()
  const labelLower = label.toLowerCase()
  const idx = lineLower.indexOf(labelLower)
  if (idx === -1) return null
  const afterLabel = line.slice(idx + label.length)
  const matches = afterLabel.match(/([\d,]+\.\d{1,2})(?!\d)/g)
  if (!matches || matches.length === 0) return null
  const ytdIdx = ytd ? 1 : 0
  if (ytdIdx < matches.length) return extractMoney(matches[ytdIdx])
  return extractMoney(matches[0])
}

export function parsePaycheckText(rawText: string): ParsedPaycheck {
  const result: ParsedPaycheck = {}

  // Collapse doubled glyphs ("SSaallaarryy" -> "Salary", "6644" -> "64").
  // Only fires when every character in a token is repeated in pairs, so real
  // values like "400.00" or "64,614.11" are never touched.
  const lines = rawText.split('\n').map((line) =>
    line.split(/\s+/)
      .map((token) => {
        if (token.length >= 2 && token.length % 2 === 0 && token.replace(/(.)\1/g, '').length === 0) {
          return token.replace(/(.)\1/g, '$1')
        }
        return token
      })
      .join(' ')
  )

  // Pass 1: Company, employee ID, dates
  for (const line of lines) {
    const lineLower = line.toLowerCase()

    if (lineLower.includes('voyix')) result.company = 'NCR Voyix Corporation'

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

  // Some extractions put the check date on its own line below the pay period
  // dates. Fall back to the first date that follows the pay period end.
  if (!result.check_date && result.pay_period_end) {
    for (const line of lines) {
      const dates = line.match(/(\d{2}\/\d{2}\/\d{4})/g)
      if (dates) {
        for (const d of dates) {
          const cd = parseDate(d)
          if (cd && cd > result.pay_period_end) {
            result.check_date = cd
            break
          }
        }
      }
      if (result.check_date) break
    }
  }

  // Pass 2: Employee name
  for (const line of lines) {
    const lineLower = line.toLowerCase()
    const words = line.split(/\s+/)

    if (lineLower.includes('richard') || lineLower.includes('johnson')) {
      const nameWords: string[] = []
      for (const word of words) {
        const cleanWord = word.replace(/[:;,.]/g, '')
        if (cleanWord[0] && cleanWord[0].toUpperCase() === cleanWord[0] && cleanWord.length > 2 && !/\d/.test(cleanWord)) {
          const wl = cleanWord.toLowerCase()
          if (wl !== 'voyix' && wl !== 'corporation' &&
              !['name', 'company', 'employee', 'description', 'amount', 'current', 'ytd', 'hours', 'gross', 'tax', 'net'].includes(wl)) {
            nameWords.push(cleanWord)
            if (nameWords.length >= 2) break
          }
        }
      }
      if (nameWords.length > 0) result.employee_name = nameWords.join(' ')
    }
  }

  // Pass 3: Summary line (Current period)
  // Try single-line format first (all values on one line)
  let summaryLine: string | null = null
  for (const line of lines) {
    const lineLower = line.toLowerCase()
    if (lineLower.includes('current') && /\b\d{2}\.\d{2}\b/.test(line) && !lineLower.trim().startsWith('hours worked')) {
      const moneyMatches = line.match(/([\d,]+\.\d{2})/g)
      if (moneyMatches && moneyMatches.length >= 5) {
        summaryLine = line
        break
      }
    }
  }

  if (summaryLine) {
    const summaryIdx = lines.indexOf(summaryLine)
    let moneyMatches: string[] = (summaryLine.match(/([\d,]+\.\d{2})/g) || []) as string[]
    // The net-pay value sometimes sits alone on the next line (pdfjs splits
    // wide rows), so pick it up when the Current line only has five values.
    if (moneyMatches.length === 5 && summaryIdx >= 0 && summaryIdx + 1 < lines.length) {
      const nextLine = lines[summaryIdx + 1]
      const nextMatches = nextLine ? nextLine.match(/([\d,]+\.\d{2})/g) : null
      if (nextMatches && nextMatches.length === 1 && /^\s*[\d,.]+/.test(nextLine ?? '')) {
        moneyMatches = moneyMatches.concat(nextMatches)
      }
    }
    if (moneyMatches.length >= 6) {
      result.hours_worked = extractMoney(moneyMatches[0]) ?? 0
      result.gross_pay = extractMoney(moneyMatches[1]) ?? 0
      result.pre_tax_deductions = extractMoney(moneyMatches[2]) ?? 0
      result.employee_taxes = extractMoney(moneyMatches[3]) ?? 0
      result.post_tax_deductions = extractMoney(moneyMatches[4]) ?? 0
      result.net_pay = extractMoney(moneyMatches[5]) ?? 0
    }
  } else {
    // Fallback: extract from individual lines (separate-line format)
    for (const line of lines) {
      const lineLower = line.toLowerCase()
      const val = getValueAfterLabel(line, 'hours worked')
      if (val !== null && result.hours_worked === undefined) result.hours_worked = val
      const gv = getValueAfterLabel(line, 'gross pay')
      if (gv !== null && result.gross_pay === undefined) result.gross_pay = gv
      const pt = getValueAfterLabel(line, 'pre-tax deductions')
      if (pt !== null && result.pre_tax_deductions === undefined) result.pre_tax_deductions = pt
      const et = getValueAfterLabel(line, 'employee taxes')
      if (et !== null && result.employee_taxes === undefined) result.employee_taxes = et
      const pot = getValueAfterLabel(line, 'post-tax deductions')
      if (pot !== null && result.post_tax_deductions === undefined) result.post_tax_deductions = pot
      const np = getValueAfterLabel(line, 'net pay')
      if (np !== null && result.net_pay === undefined) result.net_pay = np
    }
  }

  // Pass 4: YTD line
  let ytdLine: string | null = null
  for (const line of lines) {
    const lineLower = line.toLowerCase()
    if (lineLower.includes('ytd') && /^\s*YTD/i.test(line)) {
      const moneyMatches = line.match(/([\d,]+\.\d{2})/g)
      if (moneyMatches && moneyMatches.length >= 5) {
        ytdLine = line
        break
      }
    }
  }

  if (ytdLine) {
    const ytdIdx = lines.indexOf(ytdLine)
    let moneyMatches: string[] = (ytdLine.match(/([\d,]+\.\d{2})/g) || []) as string[]
    if (moneyMatches.length === 5 && ytdIdx >= 0 && ytdIdx + 1 < lines.length) {
      const nextLine = lines[ytdIdx + 1]
      const nextMatches = nextLine ? nextLine.match(/([\d,]+\.\d{2})/g) : null
      if (nextMatches && nextMatches.length === 1 && /^\s*[\d,.]+/.test(nextLine ?? '')) {
        moneyMatches = moneyMatches.concat(nextMatches)
      }
    }
    if (moneyMatches.length >= 6) {
      result.hours_worked_ytd = extractMoney(moneyMatches[0]) ?? 0
      result.gross_pay_ytd = extractMoney(moneyMatches[1]) ?? 0
      result.pre_tax_deductions_ytd = extractMoney(moneyMatches[2]) ?? 0
      result.employee_taxes_ytd = extractMoney(moneyMatches[3]) ?? 0
      result.post_tax_deductions_ytd = extractMoney(moneyMatches[4]) ?? 0
      result.net_pay_ytd = extractMoney(moneyMatches[5]) ?? 0
    }
  } else {
    // Fallback: extract from individual lines (separate-line YTD format)
    for (const line of lines) {
      const lineLower = line.toLowerCase()
      if (!lineLower.includes('ytd')) continue
      const hw = getValueAfterLabel(line, 'hours worked', true)
      if (hw !== null && result.hours_worked_ytd === undefined) result.hours_worked_ytd = hw
      const gp = getValueAfterLabel(line, 'gross pay', true)
      if (gp !== null && result.gross_pay_ytd === undefined) result.gross_pay_ytd = gp
      const pt = getValueAfterLabel(line, 'pre-tax deductions', true)
      if (pt !== null && result.pre_tax_deductions_ytd === undefined) result.pre_tax_deductions_ytd = pt
      const et = getValueAfterLabel(line, 'employee taxes', true)
      if (et !== null && result.employee_taxes_ytd === undefined) result.employee_taxes_ytd = et
      const pot = getValueAfterLabel(line, 'post-tax deductions', true)
      if (pot !== null && result.post_tax_deductions_ytd === undefined) result.post_tax_deductions_ytd = pot
      const np = getValueAfterLabel(line, 'net pay', true)
      if (np !== null && result.net_pay_ytd === undefined) result.net_pay_ytd = np
    }
  }

  // Pass 5: Line-by-line extraction (faithful to Python version)
  for (const line of lines) {
    const lineLower = line.toLowerCase()

    // 401k savings plan (both "401k" and "401(k)" variants)
    if (lineLower.includes('401k savings plan') || lineLower.includes('401(k) savings plan')) {
      // Try both label variants for extraction
      const val = getValueAfterLabel(line, '401(k)') ?? getValueAfterLabel(line, '401k')
      const valYtd = getValueAfterLabel(line, '401(k)', true) ?? getValueAfterLabel(line, '401k', true)
      if (val !== null) result.retirement_401k = val
      if (valYtd !== null) result.retirement_401k_ytd = valYtd
    }

    // Medical plan/insurance
    if (lineLower.includes('medical') && (lineLower.includes('plan') || lineLower.includes('ins'))) {
      result.health_insurance = getValueAfterLabel(line, 'medical') ?? undefined
      result.health_insurance_ytd = getValueAfterLabel(line, 'medical', true) ?? undefined
    }

    // Dental plan
    if (lineLower.includes('dental plan')) {
      result.dental_plan = getValueAfterLabel(line, 'dental') ?? undefined
      result.dental_plan_ytd = getValueAfterLabel(line, 'dental', true) ?? undefined
    }

    // Eye plan
    if (lineLower.includes('eye plan')) {
      result.eye_plan = getValueAfterLabel(line, 'eye') ?? undefined
      result.eye_plan_ytd = getValueAfterLabel(line, 'eye', true) ?? undefined
    }

    // Health care FSA
    if (lineLower.includes('health care fsa')) {
      result.health_care_fsa = getValueAfterLabel(line, 'fsa') ?? undefined
      result.health_care_fsa_ytd = getValueAfterLabel(line, 'fsa', true) ?? undefined
    }

    // Optional life
    if (lineLower.includes('optional life')) {
      result.optional_life = getValueAfterLabel(line, 'optional life') ?? undefined
      result.optional_life_ytd = getValueAfterLabel(line, 'optional life', true) ?? undefined
    }

    // ADD insurance
    if (lineLower.includes('add insurance')) {
      result.add_insurance = getValueAfterLabel(line, 'add') ?? undefined
      result.add_insurance_ytd = getValueAfterLabel(line, 'add', true) ?? undefined
    }

    // Federal withholding (exclude taxable lines)
    if (lineLower.includes('federal withholding') && !lineLower.includes('taxable')) {
      result.federal_tax = getValueAfterLabel(line, 'federal withholding') ?? undefined
      result.federal_tax_ytd = getValueAfterLabel(line, 'federal withholding', true) ?? undefined
    }

    // State tax / GA withholding (exclude federal and taxable lines)
    if ((lineLower.includes('state tax') || lineLower.includes('ga withholding') || lineLower.includes('withholding') || lineLower.includes('ga')) &&
        !lineLower.includes('federal') && !lineLower.includes('taxable')) {
      const taxVal = getValueAfterLabel(line, 'withholding') || getValueAfterLabel(line, 'state')
      if (taxVal) {
        result.state_tax = taxVal
        result.state_name = 'GA'
        result.state_tax_ytd = getValueAfterLabel(line, 'state', true) || getValueAfterLabel(line, 'withholding', true) || undefined
      }
    }

    // OASDI (exclude taxable and social security lines)
    if (lineLower.includes('oasdi') && !lineLower.includes('taxable') && !lineLower.includes('social security')) {
      result.oasdi = getValueAfterLabel(line, 'oasdi') ?? undefined
      result.oasdi_ytd = getValueAfterLabel(line, 'oasdi', true) ?? undefined
    }

    // Medicare (exclude taxable lines)
    if (/medicare/.test(lineLower) && !lineLower.includes('taxable')) {
      result.medicare = getValueAfterLabel(line, 'medicare') ?? undefined
      result.medicare_ytd = getValueAfterLabel(line, 'medicare', true) ?? undefined
    }

    // 401k employer match
    if ((lineLower.includes('401k') || lineLower.includes('401(k)')) && lineLower.includes('employer') && lineLower.includes('match')) {
      result.employer_match = getValueAfterLabel(line, 'match') ?? undefined
      result.employer_match_ytd = getValueAfterLabel(line, 'match', true) ?? undefined
    }

    // HSA employee
    if (lineLower.includes('hsa') && lineLower.includes('employee')) {
      result.hsa = getValueAfterLabel(line, 'hsa') ?? undefined
      result.hsa_ytd = getValueAfterLabel(line, 'hsa', true) ?? undefined
    }

    // HSA employer
    if (lineLower.includes('hsa') && lineLower.includes('employer')) {
      result.employer_hsa = getValueAfterLabel(line, 'hsa') ?? undefined
      result.employer_hsa_ytd = getValueAfterLabel(line, 'hsa', true) ?? undefined
    }

    // Loan repayment / 401k loan
    if (lineLower.includes('loan repayment') || lineLower.includes('401k loan') || lineLower.includes('401(k) loan')) {
      result.loan_repayment = getValueAfterLabel(line, 'loan') ?? undefined
      result.loan_repayment_ytd = getValueAfterLabel(line, 'loan', true) ?? undefined
    }

    // Dependent life
    if (lineLower.includes('dependent life')) {
      result.dependent_life = getValueAfterLabel(line, 'dependent life') ?? undefined
      result.dependent_life_ytd = getValueAfterLabel(line, 'dependent life', true) ?? undefined
    }

    // Stock purchase / employee stock
    if (lineLower.includes('stock purchase') || lineLower.includes('employee stock')) {
      result.stock_purchase = getValueAfterLabel(line, 'stock') ?? undefined
      result.stock_purchase_ytd = getValueAfterLabel(line, 'stock', true) ?? undefined
    }

    // Spousal life
    if (lineLower.includes('spousal life')) {
      result.spousal_life = getValueAfterLabel(line, 'spousal life') ?? undefined
      result.spousal_life_ytd = getValueAfterLabel(line, 'spousal life', true) ?? undefined
    }

    // Biometric credit (not spousal)
    if (lineLower.includes('biometric credit') && !lineLower.includes('spousal')) {
      result.biometric_credit = getValueAfterLabel(line, 'biometric') ?? undefined
      result.biometric_credit_ytd = getValueAfterLabel(line, 'biometric', true) ?? undefined
    }

    // Spousal biometric credit
    if (lineLower.includes('spousal biometric credit')) {
      result.spousal_biometric = getValueAfterLabel(line, 'spousal biometric') ?? undefined
      result.spousal_biometric_ytd = getValueAfterLabel(line, 'spousal biometric', true) ?? undefined
    }

    // Group term life
    if (lineLower.includes('group term life')) {
      result.group_term_life = getValueAfterLabel(line, 'group term') ?? undefined
      result.group_term_life_ytd = getValueAfterLabel(line, 'group term', true) ?? undefined
    }

    // Floating holiday
    if (lineLower.includes('floating holiday')) {
      result.floating_holiday = getValueAfterLabel(line, 'floating holiday') ?? undefined
      result.floating_holiday_ytd = getValueAfterLabel(line, 'floating holiday', true) ?? undefined
    }

    // Holiday pay (exclude "holiday pay" label and "floating")
    if (/\bholiday\b/.test(lineLower) && !lineLower.includes('holiday pay') && !lineLower.includes('floating')) {
      result.holiday_pay = getValueAfterLabel(line, 'holiday') ?? undefined
      result.holiday_pay_ytd = getValueAfterLabel(line, 'holiday', true) ?? undefined
    }

    // Vacation pay (starts with "vacation")
    if (/^vacation\s/.test(lineLower)) {
      result.vacation_pay = getValueAfterLabel(line, 'vacation') ?? undefined
      result.vacation_pay_ytd = getValueAfterLabel(line, 'vacation', true) ?? undefined
    }

    // Salary (starts with "salary")
    if (/^salary\s/.test(lineLower)) {
      result.salary = getValueAfterLabel(line, 'salary') ?? undefined
      result.salary_ytd = getValueAfterLabel(line, 'salary', true) ?? undefined
    }

    // PNC bank
    if (lineLower.includes('pnc')) {
      result.bank_name = 'PNC Bank'
      const depositVal = getValueAfterLabel(line, 'pnc')
      if (depositVal) result.deposit_amount = depositVal
    }

    // First Tech bank
    if (lineLower.includes('first tech') || lineLower.includes('firsttech')) {
      result.bank2_name = 'First Tech Federal Credit Union'
      const depositVal = getValueAfterLabel(line, 'first') || getValueAfterLabel(line, 'tech')
      if (depositVal) result.deposit2_amount = depositVal
    }

    // Account numbers (******1234). The doubled-glyph de-dup above may halve
    // the asterisk run ("******1234" -> "***1234"), so match 2+ stars.
    // When a bank name and account appear on the same line, they belong
    // together (e.g. "First Tech ******1475"); otherwise fall back to a
    // first-available assignment.
    const accMatch = line.match(/\*{2,}(\d{4})/)
    if (accMatch) {
      const acc = '****' + accMatch[1]
      const hasFirstTech = /first tech|firsttech/.test(lineLower)
      const hasPnc = lineLower.includes('pnc')
      if (hasFirstTech && !result.account2_number) {
        result.account2_number = acc
      } else if (hasPnc && !result.account_number) {
        result.account_number = acc
      } else if (result.bank_name === 'PNC Bank' && !result.account_number) {
        result.account_number = acc
      } else if (result.bank2_name && !result.account2_number) {
        result.account2_number = acc
      }
    }
  }

  // Pass 5b: Fill missing deposit amounts. Two real-world formats:
  //  1. Shared line with both deposits, no dollar sign, separated by "USD":
  //        "3,349.98     USD 50.00     USD"  -> PNC=3349.98, First Tech=50.00
  //  2. Amounts on their own line after each bank name:
  //        "PNC Bank" / "Account ...****1475" / "$9,850.00 USD"
  // For the shared line, order follows the bank order (PNC first, First Tech
  // second). For separate lines, associate the first standalone amount that
  // follows each bank name.
  const sharedAmtLine = lines.find((l) => {
    const money = l.match(/([\d,]+\.\d{2})/g)
    return !!money && money.length >= 2 && /usd/i.test(l)
  })
  if (sharedAmtLine) {
    const money = sharedAmtLine.match(/([\d,]+\.\d{2})/g) as string[]
    const first = extractMoney(money[0])
    const second = extractMoney(money[1])
    if (result.deposit_amount === undefined && first !== null) result.deposit_amount = first
    if (result.deposit2_amount === undefined && second !== null) result.deposit2_amount = second
  }

  const fillDeposit = (bankMatch: RegExp, amountField: keyof ParsedPaycheck): void => {
    if (result[amountField] !== undefined && result[amountField] !== null) return
    for (let i = 0; i < lines.length; i++) {
      if (!bankMatch.test(lines[i].toLowerCase())) continue
      for (let j = i + 1; j < lines.length && j <= i + 4; j++) {
        const amt = lines[j].match(/\$\s*([\d,]+\.\d{2})/)
        if (amt) { const v = extractMoney(amt[1]); if (v !== null) result[amountField] = v; break }
      }
    }
  }
  if (result.deposit_amount === undefined) fillDeposit(/pnc/, 'deposit_amount')
  if (result.deposit2_amount === undefined) fillDeposit(/first tech|firsttech/, 'deposit2_amount')

  // Pass 6: Earnings hours & rate (and amount when missing). Handles both
  // same-line entries ("Vacation 0 3,231.87") and multi-line entries where the
  // label sits on its own line followed by dates/hours/rate/amount/ytd.
  const EARNINGS_DEFS: Array<{ match: RegExp; amount: string; hours: string; rate: string }> = [
    { match: /spousal biometric/, amount: 'spousal_biometric', hours: 'spousal_biometric_hours', rate: 'spousal_biometric_rate' },
    { match: /biometric credit/, amount: 'biometric_credit', hours: 'biometric_credit_hours', rate: 'biometric_credit_rate' },
    { match: /floating holiday/, amount: 'floating_holiday', hours: 'floating_holiday_hours', rate: 'floating_holiday_rate' },
    { match: /\bholiday\b/, amount: 'holiday_pay', hours: 'holiday_pay_hours', rate: 'holiday_pay_rate' },
    { match: /\bvacation\b/, amount: 'vacation_pay', hours: 'vacation_hours', rate: 'vacation_rate' },
    { match: /group term life/, amount: 'group_term_life', hours: 'group_term_life_hours', rate: 'group_term_life_rate' },
    { match: /\bsalary\b/, amount: 'salary', hours: 'salary_hours', rate: 'salary_rate' },
    { match: /pscp|payslip name|other earnings/, amount: 'other_earnings', hours: 'other_earnings_hours', rate: 'other_earnings_rate' },
  ]

  const earningsTokens = (text: string): { hours: number | null; rate: number | null; amount: number | null; ytd: number | null } => {
    const stripped = text.replace(/\d{2}\/\d{2}\/\d{4}(\s*[-–]\s*\d{2}\/\d{2}\/\d{4})?/g, ' ')
    const moneyMatches: string[] = stripped.match(/(\d[\d,]*\.\d{1,2})(?!\d)/g) || []
    const allNumMatches: string[] = stripped.match(/(\d[\d,]*(?:\.\d+)?)/g) || []
    const nums = allNumMatches
      .filter((t) => !moneyMatches.includes(t))
      .map((t) => parseFloat(t.replace(/,/g, '')))
      .filter((n) => !isNaN(n))
    const amounts = moneyMatches.map((t) => parseFloat(t.replace(/,/g, ''))).filter((n) => !isNaN(n))
    return {
      hours: nums.length > 0 ? nums[0] : null,
      rate: nums.length > 1 ? nums[1] : null,
      amount: amounts.length > 0 ? amounts[0] : null,
      ytd: amounts.length > 1 ? amounts[1] : null,
    }
  }

  const EARNINGS_SECTION_END = /^\s*(employee taxes|pre tax|post tax|employer paid benefits|taxable wages|earnings\b|payment information|federal\b|state\b|oasdi\b|medicare\b|401\s*k\b|dental\b|medical\b|eye plan|health care|fsa\b|optional life|add insurance|loan\b|stock\b|spousal life|dependent life|employer match|hsa\b|benefits\b)/i

  let inEarnings = false
  let currentEntry: { def: (typeof EARNINGS_DEFS)[number]; buffer: string[] } | null = null

  const flushEarningsEntry = () => {
    if (!currentEntry) return
    const parsed = earningsTokens(currentEntry.buffer.join(' '))
    const cur = result as unknown as Record<string, number | undefined>
    if (parsed.hours !== null) cur[currentEntry.def.hours] = parsed.hours
    if (parsed.rate !== null) cur[currentEntry.def.rate] = parsed.rate
    if (parsed.amount !== null && cur[currentEntry.def.amount] === undefined) cur[currentEntry.def.amount] = parsed.amount
    currentEntry = null
  }

  for (const line of lines) {
    const lineLower = line.toLowerCase()
    if (EARNINGS_SECTION_END.test(lineLower)) {
      if (currentEntry) flushEarningsEntry()
      if (!lineLower.includes('earnings')) inEarnings = false
      continue
    }
    if (lineLower.includes('hours') && lineLower.includes('rate') && lineLower.includes('amount') && lineLower.includes('description')) {
      if (currentEntry) flushEarningsEntry()
      inEarnings = true
      continue
    }
    let def: (typeof EARNINGS_DEFS)[number] | undefined
    for (const d of EARNINGS_DEFS) {
      if (d.match.test(lineLower)) { def = d; break }
    }
    if (def) {
      if (currentEntry) flushEarningsEntry()
      currentEntry = { def, buffer: [line] }
      inEarnings = true
      continue
    }
    if (inEarnings && currentEntry) {
      currentEntry.buffer.push(line)
    }
  }
  if (currentEntry) flushEarningsEntry()

  // Fallback: find any account number if not yet found
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
