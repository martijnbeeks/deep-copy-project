import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Check if maintenance mode is enabled
  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true'
  
  if (!maintenanceMode) {
    // Maintenance mode is off, allow all requests
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  // Allow access to maintenance page itself
  if (pathname === '/maintenance') {
    return NextResponse.next()
  }

  // Allow access to static files and API routes (optional - you may want to block API too)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|mp4|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next()
  }

  // Check for bypass cookie
  const bypassCookie = request.cookies.get('maintenance-bypass')
  
  if (bypassCookie?.value === 'true') {
    // User has bypass cookie, allow access
    return NextResponse.next()
  }

  // Check for bypass token in query parameter (for setting the cookie)
  const bypassToken = request.nextUrl.searchParams.get('bypass')
  const validBypassToken = process.env.MAINTENANCE_BYPASS_TOKEN || 'your-secret-token-here'
  
  if (bypassToken === validBypassToken) {
    // Valid bypass token, redirect to home with cookie set
    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.set('maintenance-bypass', 'true', {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: false, // Allow client-side access
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })
    return response
  }

  // All other requests redirect to maintenance page
  return NextResponse.redirect(new URL('/maintenance', request.url))
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

