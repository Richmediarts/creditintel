import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { getBills, getCreditCards, getBankAccounts, getPayees, getAllBudgetCategoriesFlat, getPaychecks, getModifiedIncomes, getTransactionsFiltered } from '@/lib/budget-db'

function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return null
  return verifyToken(token)
}

function titleCaseType(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export async function GET(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() || ''
  if (!q) {
    return NextResponse.json({ results: [] })
  }

  const results: Array<{ type: string; title: string; subtitle?: string; href: string }> = []

  try {
    const [bills, cards, accounts, payees, categories, paychecks, modifiedIncomes] = await Promise.all([
      getBills(auth.userId),
      getCreditCards(auth.userId),
      getBankAccounts(auth.userId),
      getPayees(auth.userId),
      getAllBudgetCategoriesFlat(auth.userId),
      getPaychecks(auth.userId),
      getModifiedIncomes(auth.userId),
    ])

    for (const bill of bills) {
      const txt = `${bill.payee_name || ''} ${bill.notes || ''} ${bill.account || ''} ${bill.url || ''}`
      if (txt.toLowerCase().includes(q)) {
        results.push({ type: 'Bill', title: bill.payee_name || 'Unnamed Bill', subtitle: `Due ${bill.due_date} • $${bill.amount.toFixed(2)}`, href: '/budget/bills' })
      }
    }

    for (const card of cards) {
      const txt = `${card.name || ''} ${card.institution || ''} ${card.last_four || ''}`
      if (txt.toLowerCase().includes(q)) {
        results.push({ type: 'Credit Card', title: card.name, subtitle: `${card.institution || ''} ${card.last_four ? `•••• ${card.last_four}` : ''}`.trim(), href: '/budget/credit-cards' })
      }
    }

    for (const acct of accounts) {
      const txt = `${acct.name || ''} ${acct.institution || ''} ${acct.account_number_last4 || ''}`
      if (txt.toLowerCase().includes(q)) {
        results.push({ type: 'Bank Account', title: acct.name, subtitle: `${acct.institution || ''} ${acct.account_number_last4 ? `•••• ${acct.account_number_last4}` : ''}`.trim(), href: '/budget/bank-accounts' })
      }
    }

    for (const payee of payees) {
      const txt = `${payee.name || ''} ${payee.category || ''}`
      if (txt.toLowerCase().includes(q)) {
        results.push({ type: 'Payee', title: payee.name, subtitle: payee.category, href: '/budget/payees' })
      }
    }

    for (const cat of categories) {
      const txt = `${cat.name || ''}`
      if (txt.toLowerCase().includes(q)) {
        results.push({ type: 'Category', title: cat.name, subtitle: `Monthly limit $${cat.monthly_limit.toFixed(2)}`, href: '/budget/categories' })
      }
    }

    for (const pc of paychecks) {
      const txt = `${pc.company || ''} ${pc.employee_name || ''} ${pc.notes || ''}`
      if (txt.toLowerCase().includes(q)) {
        results.push({ type: 'Paycheck', title: pc.company || pc.employee_name || 'Paycheck', subtitle: pc.pay_date ? new Date(pc.pay_date).toLocaleDateString() : undefined, href: '/budget/paychecks' })
      }
    }

    for (const income of modifiedIncomes) {
      const txt = `${income.notes || ''} ${income.amount}`
      if (txt.toLowerCase().includes(q)) {
        results.push({ type: 'Modified Income', title: income.notes || 'Modified Income', subtitle: `$${income.amount.toFixed(2)}`, href: '/budget/modified-income' })
      }
    }
  } catch {
    // ignore budget fetch errors
  }

  // Disputes
  try {
    const disputesRes = (await getDb().prepare('SELECT id, creditor_name, bureau, status FROM disputes WHERE user_id = ?').all(auth.userId)) as any[]
    for (const d of disputesRes) {
      const txt = `${d.creditor_name || ''} ${d.bureau || ''} ${d.status || ''}`
      if (txt.toLowerCase().includes(q)) {
        results.push({ type: 'Dispute', title: d.creditor_name, subtitle: `${d.bureau} • ${d.status}`, href: '/disputes' })
      }
    }
  } catch {
    // ignore dispute fetch errors
  }

  // Credit report accounts (from reports table JSON blobs)
  try {
    const reportsRes = (await getDb().prepare('SELECT bureau, data FROM reports WHERE user_id = ?').all(auth.userId)) as any[]
    for (const r of reportsRes) {
      let data: any = null
      try { data = JSON.parse(r.data) } catch { /* ignore */ }
      if (!data || !Array.isArray(data.accounts)) continue
      for (const acc of data.accounts) {
        const name = acc.creditorName || acc.name || ''
        if (name.toLowerCase().includes(q)) {
          results.push({ type: 'Credit Account', title: name, subtitle: `${r.bureau} • ${acc.accountType || ''} • ${acc.status || ''}`.trim(), href: '/report-viewer' })
        }
      }
    }
  } catch {
    // ignore credit report parse errors
  }
  return NextResponse.json({ results: results.slice(0, 20) })
}
