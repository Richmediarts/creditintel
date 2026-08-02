import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { addPaycheck } from '@/lib/budget-db'
import { parsePaycheckText } from '@/lib/parsers/paycheckParser'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const rawText = formData.get('raw_text') as string | null
    const parsedJson = formData.get('parsed_json') as string | null

    if (parsedJson) {
      const parsed = JSON.parse(parsedJson)
      const data: Record<string, string | number> = {}
      for (const [key, val] of Object.entries(parsed)) {
        if (val !== undefined && val !== null && val !== '') {
          data[key] = val as string | number
        }
      }

      const numericFields = [
        'hours_worked', 'gross_pay', 'pre_tax_deductions', 'employee_taxes', 'post_tax_deductions',
        'net_pay', 'salary', 'biometric_credit', 'floating_holiday', 'holiday_pay', 'vacation_pay',
        'group_term_life', 'spousal_biometric', 'oasdi', 'medicare', 'federal_tax', 'state_tax',
        'social_security', 'retirement_401k', 'add_insurance', 'dental_plan', 'eye_plan',
        'health_care_fsa', 'health_insurance', 'optional_life', 'hsa', 'loan_repayment',
        'dependent_life', 'stock_purchase', 'spousal_life', 'employer_match', 'employer_hsa',
        'deposit_amount', 'deposit2_amount',
      ]

      const kwargs: Record<string, string | number> = {}
      for (const field of numericFields) {
        const val = String(data[field] || '0').replace(/,/g, '')
        kwargs[field] = parseFloat(val) || 0
      }

      const stringFields = [
        'pay_date', 'pay_period_begin', 'pay_period_end', 'check_date', 'check_number',
        'employee_name', 'employee_id', 'company', 'state_name', 'federal_filing_status',
        'state_filing_status', 'bank_name', 'account_number', 'bank2_name', 'account2_number',
      ]
      for (const field of stringFields) {
        const val = data[field]
        kwargs[field] = val !== undefined ? String(val) : ''
      }

      kwargs.notes = 'Imported from paystub'
      const id = await addPaycheck(user.userId, kwargs)
      return NextResponse.json({ success: true, id })
    }

    if (rawText) {
      const parsed = parsePaycheckText(rawText)
      return NextResponse.json({ success: true, parsed })
    }

    return NextResponse.json({ error: 'No text or parsed data provided' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
