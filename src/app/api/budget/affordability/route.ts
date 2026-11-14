import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getHomeAffordabilityData } from '@/lib/home-affordability-data'
import { buildHomePlan, validateHomePlan } from '@/lib/utils/home-affordability'

function authenticate(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  return token ? verifyToken(token) : null
}
export async function GET(request: NextRequest) {
  const auth = authenticate(request)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    return NextResponse.json({ data: await getHomeAffordabilityData(auth.userId) })
  } catch (error) {
    console.error('affordability GET', error)
    return NextResponse.json({ error: 'Unable to load the home plan. Try again.' }, { status: 500 })
  }
}
export async function POST(request: NextRequest) {
  if (!authenticate(request)) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Send valid calculator inputs.' }, { status: 400 })
  }
  if (!validateHomePlan(body)) return NextResponse.json({ error: 'Review amounts, debt payments, percentages and loan terms.' }, { status: 400 })
  return NextResponse.json({ result: buildHomePlan(body) })
}
