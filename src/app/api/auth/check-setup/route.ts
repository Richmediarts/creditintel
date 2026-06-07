import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count
  return NextResponse.json({ setupNeeded: userCount === 0 })
}
