import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Legacy /admin protection (exactement /admin ou /admin/*)
  if (
    (pathname === '/admin' || pathname.startsWith('/admin/')) &&
    pathname !== '/admin/login'
  ) {
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Client dashboard protection
  if (
    (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) &&
    pathname !== '/dashboard/login'
  ) {
    const token = request.cookies.get('client_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/dashboard/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*'],
}
