import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { execSync } from 'child_process'
import path from 'path'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const auth = verifyToken(token)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'seed-real-data.cjs')
    execSync(`node "${scriptPath}"`, { cwd: process.cwd(), stdio: 'pipe' })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Enrich failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
