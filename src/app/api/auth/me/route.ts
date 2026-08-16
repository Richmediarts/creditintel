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
  const identityId = payload.profileUserId || payload.userId
  const user = await db.get('SELECT id, name, email, role, address, is_example, created_at FROM users WHERE id = ?', [identityId])

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }

  const isExample = !!payload.isExample || !!user.is_example

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: isExample ? 'member' : user.role, address: user.address || '', createdAt: user.created_at, isExample },
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

  if (payload.isExample) {
    return NextResponse.json({ error: 'This is a read-only example account. Account settings are locked.' }, { status: 403 })
  }

  const db = getDb()
  const user = await db.get('SELECT * FROM users WHERE id = ?', [payload.userId])
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }

  try {
    const { email, name, address, currentPassword, newPassword } = await request.json()

    if (name !== undefined) {
      await db.run('UPDATE users SET name = ? WHERE id = ?', [name.trim(), user.id])
    }

    if (address !== undefined) {
      await db.run('UPDATE users SET address = ? WHERE id = ?', [address.trim(), user.id])
    }

    if (email) {
      const existing = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email.toLowerCase().trim(), user.id])
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
      await db.run('UPDATE users SET email = ? WHERE id = ?', [email.toLowerCase().trim(), user.id])
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
      await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id])
    }

    return NextResponse.json({ message: 'Account updated' })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to update account' }, { status: 500 })
  }
}
