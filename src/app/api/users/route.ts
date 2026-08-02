import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, hashPassword } from '@/lib/auth'
import { getDb } from '@/lib/db'

function getAdmin(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'admin') return null
  return payload
}

export async function GET(request: NextRequest) {
  const admin = getAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const users = await db.all('SELECT id, name, email, role, address, created_at FROM users ORDER BY created_at ASC', [])
  return NextResponse.json({ users })
}

export async function POST(request: NextRequest) {
  const admin = getAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name, email, password, role } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password required' }, { status: 400 })
    }

    const db = getDb()
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()])
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const result = await db.run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id',
      [name.trim(), email.toLowerCase().trim(), passwordHash, role || 'member']
    )

    return NextResponse.json({
      user: { id: result.lastInsertRowid, name: name.trim(), email: email.toLowerCase().trim(), role: role || 'member' },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to create user' }, { status: 500 })
  }
}
