import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { LinkTokenCreateRequest, LinkTokenCreateRequestUser, CountryCode, Products } from 'plaid'
import { getPlaidConfig, getPlaidClient, requirePlaidConfig } from '@/lib/plaid-client'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await getPlaidConfig()
  if (!requirePlaidConfig(config)) {
    return NextResponse.json({ error: 'Plaid not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.' }, { status: 400 })
  }

  try {
    const client = getPlaidClient(config)
    const request2: LinkTokenCreateRequest = {
      client_name: 'Budget Tracker',
      language: 'en',
      country_codes: [CountryCode.Us],
      user: { client_user_id: `user-${user.userId}` },
      products: [Products.Transactions],
    }
    const response = await client.linkTokenCreate(request2)
    return NextResponse.json({ link_token: response.data.link_token })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
