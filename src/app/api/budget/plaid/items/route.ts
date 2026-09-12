import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getPlaidItems } from '@/lib/budget-db'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const items = await getPlaidItems(user.userId)
  return NextResponse.json({ items: items.map(i => ({ id: i.id, item_id: i.item_id, institution_name: i.institution_name, needs_reconnection: i.needs_reconnection })) })
}
