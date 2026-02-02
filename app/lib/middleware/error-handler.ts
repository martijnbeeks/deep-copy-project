/**
 * Standardized error handling utilities for API routes
 */

import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

export interface ApiError {
  message: string
  status: number
  code?: string
}

/**
 * Handle API errors and return standardized responses
 */
export function handleApiError(error: unknown): NextResponse {
  logger.error('API Error:', error)

  let message = 'An unexpected error occurred'
  let status = 500

  if (error instanceof Error) {
    message = error.message

    // Handle specific error types
    if (error.name === 'AbortError' || message.includes('timeout')) {
      message = 'Request timed out. The API is taking longer than expected. Please try again.'
      status = 504 // Gateway Timeout
    } else if (message.includes('ECONNRESET') || message.includes('ENOTFOUND')) {
      message = 'Connection error. Please check your internet connection and try again.'
      status = 503 // Service Unavailable
    } else if (message.includes('not found') || message.includes('Not Found')) {
      status = 404
    } else if (message.includes('unauthorized') || message.includes('Unauthorized')) {
      status = 401
    } else if (message.includes('forbidden') || message.includes('Forbidden')) {
      status = 403
    } else if (message.includes('bad request') || message.includes('Bad Request')) {
      status = 400
    }
  }

  return NextResponse.json({ error: message }, { status })
}

/**
 * Create standardized success response with cache headers
 */
export function createSuccessResponse(data: any, status: number = 200): NextResponse {
  const response = NextResponse.json(data, { status })

  // Add cache-busting headers
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')

  return response
}

/**
 * Create validation error response
 */
export function createValidationErrorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

