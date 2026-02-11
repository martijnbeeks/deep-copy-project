import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export function middleware(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || uuidv4()
  
  // Clone request headers to inject the requestId
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  // Check if maintenance mode is enabled
  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true'
  
  const handleNext = (resp: NextResponse) => {
    resp.headers.set('x-request-id', requestId)
    return resp
  }

  if (!maintenanceMode) {
    // Maintenance mode is off, allow all requests
    return handleNext(NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }))
  }

  const { pathname } = request.nextUrl

  // Allow access to maintenance page itself
  if (pathname === '/maintenance') {
    return handleNext(NextResponse.next())
  }

  // Allow access to static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|mp4|woff|woff2|ttf|eot)$/)
  ) {
    return handleNext(NextResponse.next())
  }

  // Check for bypass cookie
  const bypassCookie = request.cookies.get('maintenance-bypass')
  
  if (bypassCookie?.value === 'true') {
    // User has bypass cookie, allow access
    return handleNext(NextResponse.next())
  }

  // Check for bypass token in query parameter (for setting the cookie)
  const bypassToken = request.nextUrl.searchParams.get('bypass')
  const validBypassToken = process.env.MAINTENANCE_BYPASS_TOKEN || 'your-secret-token-here'
  
  if (bypassToken === validBypassToken) {
    // Valid bypass token, redirect to home with cookie set
    const response = handleNext(NextResponse.redirect(new URL('/', request.url)))
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
  return handleNext(NextResponse.redirect(new URL('/maintenance', request.url)))
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

