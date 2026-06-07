import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getDb } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const db = getDb()
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim()) as any

    if (!user) {
      return NextResponse.json({ error: 'If that email exists, a reset link has been generated' }, { status: 200 })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

    db.prepare('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?').run(token, expiry, user.id)

    const resetUrl = `${request.nextUrl.origin}/reset-password/${token}`

    return NextResponse.json({
      message: 'Reset link generated',
      resetUrl,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to process request' }, { status: 500 })
  }
}
