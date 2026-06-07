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
