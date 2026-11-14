import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getBankAccount, updateBankAccount, deleteBankAccount, updateBankAccountBalance } from '@/lib/budget-db'
import fs from 'fs'
import path from 'path'

function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const account = await getBankAccount(auth.userId, Number(id))
  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }
  return NextResponse.json({ account })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(request)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (auth.isExample) return NextResponse.json({ error: 'This account is read-only.' }, { status: 403 })

  try {
    const { id } = await params
    const accountId = Number(id)
    if (!Number.isSafeInteger(accountId) || accountId < 1) {
      return NextResponse.json({ error: 'Invalid account.' }, { status: 400 })
    }
    const existing = await getBankAccount(auth.userId, accountId)
    if (!existing) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    let data
    try { data = await request.json() } catch {
      return NextResponse.json({ error: 'Send valid account details.' }, { status: 400 })
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return NextResponse.json({ error: 'Send valid account details.' }, { status: 400 })
    }
    if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 200)) {
      return NextResponse.json({ error: 'Enter an account name between 1 and 200 characters.' }, { status: 400 })
    }
    if (data.balance !== undefined) {
      if (data.balance === null || String(data.balance).trim() === '' || !Number.isFinite(Number(data.balance))) {
        return NextResponse.json({ error: 'Enter a valid balance.' }, { status: 400 })
      }
      await updateBankAccountBalance(auth.userId, accountId, Number(data.balance))
    } else {
      if (data.current_balance !== undefined && (typeof data.current_balance !== 'number' || !Number.isFinite(data.current_balance))) {
        return NextResponse.json({ error: 'Enter a valid balance.' }, { status: 400 })
      }
      await updateBankAccount(auth.userId, accountId, {
        ...existing,
        ...data,
        name: data.name !== undefined ? data.name.trim() : existing.name,
      })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update bank account' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { id } = await params
    const accountId = Number(id)
    const account = await getBankAccount(auth.userId, accountId)
    await deleteBankAccount(auth.userId, accountId)

    // Persist deletion to seed.json so it survives Vercel cold starts (best-effort)
    if (account) {
      try {
        const seedPath = path.join(process.cwd(), 'seed', 'seed.json')
        if (fs.existsSync(seedPath)) {
          const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
          if (seed.budget_bank_accounts) {
            seed.budget_bank_accounts = seed.budget_bank_accounts.filter((a: { id: number }) => a.id !== accountId)
            fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2))
          }
        }
      } catch { /* best-effort */ }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete bank account' }, { status: 500 })
  }
}