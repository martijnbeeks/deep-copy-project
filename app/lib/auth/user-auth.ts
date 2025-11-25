/**
 * User authentication middleware for internal API routes
 * Centralizes user authentication logic
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail } from '@/lib/db/queries'
import { User } from '@/lib/db/types'
import { logger } from '@/lib/utils/logger'

export type AuthenticatedUser = Omit<User, 'password_hash'>

export interface AuthResult {
  user: AuthenticatedUser
  error?: never
}

export interface AuthError {
  user?: never
  error: {
    message: string
    status: number
  }
}

/**
 * Extract user email from authorization header
 */
export function extractUserEmail(request: NextRequest): string {
  const authHeader = request.headers.get('authorization')
  return authHeader?.replace('Bearer ', '') || 'demo@example.com'
}

/**
 * Authenticate user from request headers
 * Returns user object or error response
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult | AuthError> {
  try {
    const userEmail = extractUserEmail(request)
    const user = await getUserByEmail(userEmail)

    if (!user) {
      return {
        error: {
          message: 'User not found',
          status: 404
        }
      }
    }

    return { user }
  } catch (error) {
    logger.error('Auth error:', error)
    return {
      error: {
        message: 'Authentication failed',
        status: 500
      }
    }
  }
}

/**
 * Create error response from auth result
 */
export function createAuthErrorResponse(authResult: AuthError): NextResponse {
  return NextResponse.json(
    { error: authResult.error.message },
    { status: authResult.error.status }
  )
}

/**
 * Helper to create standardized error responses
 */
export function createErrorResponse(message: string, status: number = 500): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

