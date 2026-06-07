import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const db = getDb()
    const user = db.prepare(
      'SELECT id, reset_token_expiry FROM users WHERE reset_token = ?'
    ).get(token) as any

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
    }

    if (new Date(user.reset_token_expiry) < new Date()) {
      db.prepare('UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?').run(user.id)
      return NextResponse.json({ error: 'Reset token has expired. Request a new one.' }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)
    db.prepare(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?'
    ).run(passwordHash, user.id)

    return NextResponse.json({ message: 'Password reset successful. You can now sign in.' })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to reset password' }, { status: 500 })
  }
}
