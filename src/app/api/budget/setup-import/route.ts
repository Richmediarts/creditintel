import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import {
  addBankAccount, addCreditCard, addBill, addBudgetCategory, addPayee, addPaycheck,
  getBudgetCategories,
} from '@/lib/budget-db'

type SetupRow = {
  type: string
  name: string
  amount: string
  institution: string
  last4: string
  balance: string
  limit: string
  apr: string
  due_date: string
  account_type: string
  is_recurring: string
  recurrence_type: string
  is_paid: string
  category: string
  company: string
  website: string
  notes: string
  check_date: string
  net_pay: string
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const push = () => {
    row.push(field)
    field = ''
  }
  let pos = 0
  while (pos < content.length) {
    const char = content[pos]
    if (inQuotes) {
      if (char === '"') {
        if (content[pos + 1] === '"') { field += '"'; pos++ }
        else inQuotes = false
      } else field += char
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      push()
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[pos + 1] === '\n') pos++
      push()
      rows.push(row)
      row = []
    } else {
      field += char
    }
    pos++
  }
  if (field !== '' || row.length > 0) {
    push()
    rows.push(row)
  }
  return rows.filter((r) => r.length > 0)
}

function parseHeaderRow(row: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  row.forEach((h, i) => {
    const key = h.trim().toLowerCase()
    if (key) map[key] = i
  })
  return map
}

function num(val: string | undefined): number {
  if (val === undefined) return 0
  const n = parseFloat(String(val).replace(/[$,\s]/g, ''))
  return isNaN(n) ? 0 : n
}

function str(val: string | undefined): string {
  return val === undefined ? '' : String(val).trim()
}

const VALID_TYPES = ['category', 'payee', 'bank_account', 'credit_card', 'bill', 'paycheck']

export async function POST(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('csv_file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No CSV file uploaded' }, { status: 400 })
    }
    const content = await file.text()

    const rawRows = parseCsv(content)
    if (rawRows.length < 2) {
      return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 })
    }

    const headerIndex = rawRows.findIndex((r) => String(r[0] || '').trim().toLowerCase() === 'type')
    const headerRow = rawRows[headerIndex]
    if (!headerRow) {
      return NextResponse.json({ error: 'CSV is missing a header row starting with "type"' }, { status: 400 })
    }
    const col = parseHeaderRow(headerRow)

    const dataRows = rawRows.slice(headerIndex + 1)
    const categories = await getBudgetCategories(user.userId)

    let count = 0
    const skippedRows: string[] = []
    const counts: Record<string, number> = { category: 0, payee: 0, bank_account: 0, credit_card: 0, bill: 0, paycheck: 0 }

    for (const row of dataRows) {
      if (row.length === 0 || row.every((c) => !String(c).trim())) continue
      const type0 = String(row[0] || '').trim()
      if (type0.startsWith('#')) continue
      const get = (name: string): string => {
        const idx = col[name]
        return idx === undefined ? '' : str(row[idx])
      }
      const r: SetupRow = {
        type: get('type'), name: get('name'), amount: get('amount'), institution: get('institution'),
        last4: get('last4'), balance: get('balance'), limit: get('limit'), apr: get('apr'),
        due_date: get('due_date'), account_type: get('account_type'), is_recurring: get('is_recurring'),
        recurrence_type: get('recurrence_type'), is_paid: get('is_paid'), category: get('category'),
        company: get('company'), website: get('website'), notes: get('notes'),
        check_date: get('check_date'), net_pay: get('net_pay'),
      }

      const type = r.type.trim().toLowerCase()
      if (!type) continue
      if (!VALID_TYPES.includes(type)) {
        skippedRows.push(`Row "${r.name || type}" skipped: unknown type "${type}"`)
        continue
      }

      try {
        if (type === 'category') {
          if (!r.name) throw new Error('Category requires a name')
          await addBudgetCategory(user.userId, { name: r.name, monthly_limit: num(r.amount), color: '#2E7D32' })
        } else if (type === 'payee') {
          if (!r.name) throw new Error('Payee requires a name')
          await addPayee(user.userId, { name: r.name, category: r.category || undefined, notes: r.notes || undefined, website: r.website || undefined })
        } else if (type === 'bank_account') {
          if (!r.name) throw new Error('Bank account requires a name')
          await addBankAccount(user.userId, {
            name: r.name,
            account_type: r.account_type || 'checking',
            institution: r.institution || undefined,
            account_number_last4: r.last4 || undefined,
            current_balance: num(r.balance),
            website: r.website || undefined,
            is_active: 1,
            is_income_account: 0,
          })
        } else if (type === 'credit_card') {
          if (!r.name) throw new Error('Credit card requires a name')
          await addCreditCard(user.userId, {
            name: r.name,
            institution: r.institution || undefined,
            last_four: r.last4 || undefined,
            credit_limit: num(r.limit),
            current_balance: num(r.balance),
            interest_rate: num(r.apr),
            due_date: r.due_date || undefined,
            website: r.website || undefined,
            is_active: 1,
          })
        } else if (type === 'bill') {
          if (!r.name) throw new Error('Bill requires a name')
          const catName = r.category
          let categoryId: number | null = null
          if (catName) {
            const match = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase())
            if (match) {
              categoryId = match.id
            } else {
              categoryId = await addBudgetCategory(user.userId, { name: catName, monthly_limit: 0 })
            }
          }
          await addBill(user.userId, {
            payee_name: r.name,
            amount: num(r.amount),
            due_date: r.due_date || new Date().toISOString().split('T')[0],
            is_paid: r.is_paid === '1' ? 1 : 0,
            is_recurring: r.is_recurring === '1' ? 1 : 0,
            recurrence_type: r.recurrence_type || undefined,
            category_id: categoryId || undefined,
            notes: r.notes || undefined,
          })
        } else if (type === 'paycheck') {
          if (!r.name && !r.check_date) throw new Error('Paycheck requires a company name or check date')
          await addPaycheck(user.userId, {
            company: r.name || r.company || undefined,
            check_date: r.check_date || undefined,
            net_pay: num(r.net_pay) || 0,
            notes: r.notes || undefined,
          })
        }
        count++
        counts[type]++
      } catch (e) {
        skippedRows.push(`Row "${r.name || type}": ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    return NextResponse.json({ success: true, imported: count, counts, skipped: skippedRows })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}