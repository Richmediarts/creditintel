import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hashPassword, verifyPassword, signToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const db = getDb()
    const user = (await db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim())) as any

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const isExample = !!user.is_example
    let tokenUserId = user.id
    let tokenRole: 'admin' | 'member' = user.role === 'admin' ? 'admin' : 'member'
    if (isExample) {
      tokenUserId = user.mirror_user_id || 1
      tokenRole = 'member'
    }

    const token = signToken({
      userId: tokenUserId,
      email: user.email,
      role: tokenRole,
      ...(isExample ? { isExample: true, profileUserId: user.id } : {}),
    })

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: tokenRole, isExample },
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
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Login failed' }, { status: 500 })
  }
}
