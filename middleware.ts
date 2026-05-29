import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /administration protection (single-key admin)
  if (pathname.startsWith('/administration/') && pathname !== '/administration') {
    const session = request.cookies.get('adm_session')?.value
    if (!session) {
      return NextResponse.redirect(new URL('/administration', request.url))
    }
  }

  // Legacy /admin protection
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Client dashboard protection
  if (pathname.startsWith('/dashboard') && pathname !== '/dashboard/login') {
    const token = request.cookies.get('client_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/dashboard/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/administration/:path*', '/admin/:path*', '/dashboard/:path*'],
}
