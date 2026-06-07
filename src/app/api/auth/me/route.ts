import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, hashPassword } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const payload = verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const db = getDb()
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(payload.userId) as any

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.created_at },
  })
}

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const payload = verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as any
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }

  try {
    const { email, currentPassword, newPassword } = await request.json()

    if (email) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase().trim(), user.id)
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email.toLowerCase().trim(), user.id)
    }

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password required to set a new password' }, { status: 400 })
      }
      const bcrypt = await import('bcryptjs')
      const valid = await bcrypt.compare(currentPassword, user.password_hash)
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 })
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
      }
      const passwordHash = await hashPassword(newPassword)
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id)
    }

    return NextResponse.json({ message: 'Account updated' })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to update account' }, { status: 500 })
  }
}
