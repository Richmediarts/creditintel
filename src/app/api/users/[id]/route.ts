import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

function getAdmin(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'admin') return null
  return payload
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = getAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id)) as any
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    const body = await request.json()

    if (body.password) {
      if (body.password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
      }
      const { hashPassword } = await import('@/lib/auth')
      const passwordHash = await hashPassword(body.password)
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, Number(id))
    }

    if (body.name) {
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(body.name.trim(), Number(id))
    }

    if (body.role) {
      if (body.role !== 'admin' && body.role !== 'member') {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      if (Number(id) === admin.userId) {
        return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
      }
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(body.role, Number(id))
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const request = _request
  const admin = getAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id)) as any
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (user.id === admin.userId) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
  }
  if (user.role === 'admin') {
    const adminCount = (db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin') as any).count
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last admin' }, { status: 400 })
    }
  }

  db.prepare('DELETE FROM disputes WHERE user_id = ?').run(Number(id))
  db.prepare('DELETE FROM users WHERE id = ?').run(Number(id))

  return NextResponse.json({ success: true })
}
