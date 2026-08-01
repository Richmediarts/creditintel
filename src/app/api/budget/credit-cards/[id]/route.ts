import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getCreditCard, updateCreditCard, deleteCreditCard, clearCreditCardPlaid, getBillsByCreditCard } from '@/lib/budget-db'
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
  const card = getCreditCard(auth.userId, Number(id))
  if (!card) {
    return NextResponse.json({ error: 'Credit card not found' }, { status: 404 })
  }
  return NextResponse.json({ card })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { id } = await params
    const data = await request.json()
    updateCreditCard(auth.userId, Number(id), data)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update credit card' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { id } = await params
    const cardId = Number(id)
    const card = getCreditCard(auth.userId, cardId)
    deleteCreditCard(auth.userId, cardId)

    // Persist deletion to seed.json so it survives Vercel cold starts (best-effort)
    if (card) {
      try {
        const seedPath = path.join(process.cwd(), 'seed', 'seed.json')
        if (fs.existsSync(seedPath)) {
          const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
          if (seed.budget_credit_cards) {
            seed.budget_credit_cards = seed.budget_credit_cards.filter((c: { id: number }) => c.id !== cardId)
            fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2))
          }
        }
      } catch { /* best-effort: local dev persists, Vercel may not */ }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete credit card' }, { status: 500 })
  }
}