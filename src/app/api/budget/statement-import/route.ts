import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { addTransactions, getTransactions } from '@/lib/budget-db'
import { parseCsvTransactions, parsePdfTransactions } from '@/lib/parsers/paycheckParser'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const accountId = Number(formData.get('account_id'))
    const clearExisting = formData.get('clear_existing') === 'on'
    const skipDuplicates = formData.get('skip_duplicates') !== 'off'
    const newAccountName = formData.get('new_name') as string | null
    const newAccountType = formData.get('new_type') as string | null || 'checking'
    const newInstitution = formData.get('new_institution') as string | null
    const newLast4 = formData.get('new_last4') as string | null
    const newBalance = Number(formData.get('new_balance')) || 0

    const file = formData.get('csv_file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const content = await file.text()
    const fname = file.name.toLowerCase()

    let transactionsList: { date: string; description: string; amount: number; balance: number }[] = []

    if (fname.endsWith('.pdf')) {
      transactionsList = parsePdfTransactions(content)
    } else {
      transactionsList = parseCsvTransactions(content)
    }

    if (transactionsList.length === 0) {
      return NextResponse.json({ error: 'No transactions found in file' }, { status: 400 })
    }

    const db = getDb()
    let targetAccountId = accountId

    if (!targetAccountId && newAccountName) {
      const result = db.prepare(
        'INSERT INTO budget_bank_accounts (user_id, name, account_type, institution, account_number_last4, current_balance) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(user.userId, newAccountName, newAccountType, newInstitution || '', newLast4 || '', newBalance)
      targetAccountId = Number(result.lastInsertRowid)
    }

    if (!targetAccountId) {
      return NextResponse.json({ error: 'Select an account or provide new account details' }, { status: 400 })
    }

    if (clearExisting) {
      const db2 = getDb()
      db2.prepare('DELETE FROM budget_transactions WHERE user_id = ? AND account_id = ?').run(user.userId, targetAccountId)
    }

    const existing = getTransactions(user.userId, targetAccountId)
    const existingKeys = new Set(existing.map(tx => `${tx.date}|${tx.amount}`))

    const newTransactions = transactionsList.filter(tx => {
      const key = `${tx.date}|${tx.amount}`
      if (existingKeys.has(key)) return false
      return true
    })

    const dupCount = transactionsList.length - newTransactions.length

    if (newTransactions.length > 0) {
      addTransactions(user.userId, targetAccountId, newTransactions)

      const sorted = [...newTransactions].sort((a, b) => b.date.localeCompare(a.date))
      const latestBalance = sorted[0]?.balance || 0
      if (latestBalance !== 0) {
        const acct = db.prepare('SELECT * FROM budget_bank_accounts WHERE user_id = ? AND id = ?').get(user.userId, targetAccountId) as { name: string; account_type: string; institution: string; account_number_last4: string } | undefined
        if (acct) {
          db.prepare('UPDATE budget_bank_accounts SET current_balance = ? WHERE user_id = ? AND id = ?').run(latestBalance, user.userId, targetAccountId)
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported: newTransactions.length,
      duplicates: dupCount,
      total: transactionsList.length,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
