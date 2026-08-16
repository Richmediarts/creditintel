import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

const ALLOWED_WRITE_PATHS = new Set(['/api/auth/login', '/api/auth/logout'])

export function proxy(request: NextRequest) {
  const method = request.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return NextResponse.next()
  }

  const pathname = request.nextUrl.pathname
  if (ALLOWED_WRITE_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) {
    return NextResponse.next()
  }

  const payload = verifyToken(token)
  if (payload && payload.isExample) {
    return NextResponse.json(
      { error: 'This example account is read-only. Editing and deleting are disabled.' },
      { status: 403 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}