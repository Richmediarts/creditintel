import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb, calculateExpectedResponseDate } from '@/lib/db'

function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDb()
  const dispute = db.prepare('SELECT * FROM disputes WHERE id = ? AND user_id = ?').get(Number(id), auth.userId) as any
  if (!dispute) {
    return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
  }

  try {
    const updates = await request.json()
    const fields: string[] = []
    const values: any[] = []

    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
    }
    if (updates.filedDate !== undefined) {
      fields.push('filed_date = ?')
      values.push(updates.filedDate)
      const expectedDate = calculateExpectedResponseDate(dispute.bureau, updates.filedDate)
      fields.push('expected_response_date = ?')
      values.push(expectedDate)
    }
    if (updates.resolvedDate !== undefined) {
      fields.push('resolved_date = ?')
      values.push(updates.resolvedDate)
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?')
      values.push(updates.notes)
    }
    if (updates.creditorName !== undefined) {
      fields.push('creditor_name = ?')
      values.push(updates.creditorName.trim())
    }
    if (updates.inaccuracies !== undefined) {
      fields.push('inaccuracies = ?')
      values.push(JSON.stringify(updates.inaccuracies))
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    fields.push('updated_at = datetime(\'now\')')
    values.push(Number(id))

    db.prepare(`UPDATE disputes SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to update dispute' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDb()
  const result = db.prepare('DELETE FROM disputes WHERE id = ? AND user_id = ?').run(Number(id), auth.userId)
  if (result.changes === 0) {
    return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
