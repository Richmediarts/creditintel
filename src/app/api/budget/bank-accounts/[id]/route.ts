import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getBankAccount, updateBankAccount, deleteBankAccount, updateBankAccountBalance, clearBankAccountPlaid } from '@/lib/budget-db'
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
  const account = getBankAccount(auth.userId, Number(id))
  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }
  return NextResponse.json({ account })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { id } = await params
    const data = await request.json()
    
    if (data.balance !== undefined) {
      updateBankAccountBalance(auth.userId, Number(id), Number(data.balance))
    } else {
      updateBankAccount(auth.userId, Number(id), data)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
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
    const account = getBankAccount(auth.userId, accountId)
    deleteBankAccount(auth.userId, accountId)

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