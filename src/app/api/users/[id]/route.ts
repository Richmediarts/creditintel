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
  const user = await db.get('SELECT * FROM users WHERE id = ?', [Number(id)])
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (user.is_example) {
    return NextResponse.json({ error: 'The example account is locked and cannot be edited' }, { status: 403 })
  }

  try {
    const body = await request.json()

    if (body.password) {
      if (body.password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
      }
      const { hashPassword } = await import('@/lib/auth')
      const passwordHash = await hashPassword(body.password)
      await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, Number(id)])
    }

    if (body.name !== undefined) {
      await db.run('UPDATE users SET name = ? WHERE id = ?', [body.name.trim(), Number(id)])
    }

    if (body.email !== undefined) {
      const existing = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [body.email.toLowerCase().trim(), Number(id)])
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
      await db.run('UPDATE users SET email = ? WHERE id = ?', [body.email.toLowerCase().trim(), Number(id)])
    }

    if (body.address !== undefined) {
      await db.run('UPDATE users SET address = ? WHERE id = ?', [body.address.trim(), Number(id)])
    }

    if (body.role) {
      if (body.role !== 'admin' && body.role !== 'member') {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      if (user.role === 'admin' && body.role !== 'admin') {
        const adminCount = await db.get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin'])
        if (adminCount && Number(adminCount.count) <= 1) {
          return NextResponse.json({ error: 'Cannot demote the last admin' }, { status: 400 })
        }
      }
      await db.run('UPDATE users SET role = ? WHERE id = ?', [body.role, Number(id)])
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
  const user = await db.get('SELECT * FROM users WHERE id = ?', [Number(id)])
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (user.is_example) {
    return NextResponse.json({ error: 'The example account is locked and cannot be deleted' }, { status: 403 })
  }
  if (user.id === admin.userId) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
  }
  if (user.role === 'admin') {
    const adminCount = await db.get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin'])
    if (adminCount && Number(adminCount.count) <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last admin' }, { status: 400 })
    }
  }

  await db.transaction(async () => {
    await db.run('DELETE FROM disputes WHERE user_id = ?', [Number(id)])
    await db.run('DELETE FROM reports WHERE user_id = ?', [Number(id)])
    await db.run('DELETE FROM fico_scores WHERE user_id = ?', [Number(id)])
    await db.run('DELETE FROM budget_transactions WHERE user_id = ?', [Number(id)])
    await db.run('DELETE FROM budget_bills WHERE user_id = ?', [Number(id)])
    await db.run('DELETE FROM budget_paychecks WHERE user_id = ?', [Number(id)])
    await db.run('DELETE FROM budget_payees WHERE user_id = ?', [Number(id)])
    await db.run('DELETE FROM budget_categories WHERE user_id = ?', [Number(id)])
    await db.run('DELETE FROM budget_bank_accounts WHERE user_id = ?', [Number(id)])
    await db.run('DELETE FROM budget_credit_cards WHERE user_id = ?', [Number(id)])
    await db.run('DELETE FROM budget_plaid_items WHERE user_id = ?', [Number(id)])
    await db.run('DELETE FROM budget_modified_income WHERE user_id = ?', [Number(id)])
    await db.run('DELETE FROM users WHERE id = ?', [Number(id)])
  })

  return NextResponse.json({ success: true })
}
