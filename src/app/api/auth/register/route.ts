import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hashPassword, signToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    if (normalizedEmail.length < 5 || !normalizedEmail.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const db = getDb()
    const existing = (await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)) as { id: number } | null
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const result = await db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id'
    ).run(name.trim(), normalizedEmail, passwordHash, 'member')
    const userId = Number(result.lastInsertRowid)

    const token = signToken({ userId, email: normalizedEmail, role: 'member' })

    const response = NextResponse.json({
      user: { id: userId, name: name.trim(), email: normalizedEmail, role: 'member' },
    })

    response.cookies.set('credit-dashboard-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })

    return response
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Registration failed' }, { status: 500 })
  }
}