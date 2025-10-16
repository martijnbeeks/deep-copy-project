import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

// Simple admin authentication middleware
export async function verifyAdminAuth(request: NextRequest) {
  try {
    // Check for session token in headers
    const sessionToken = request.headers.get('x-admin-session')
    
    if (!sessionToken) {
      return { error: 'No session token provided' }
    }

    try {
      const decodedToken = JSON.parse(Buffer.from(sessionToken, 'base64').toString())
      const { email, timestamp } = decodedToken
      
      // Check if token is not too old (24 hours)
      const tokenAge = Date.now() - timestamp
      if (tokenAge > 24 * 60 * 60 * 1000) {
        return { error: 'Session expired' }
      }

      // Simple hardcoded admin check
      if (email !== 'admin') {
        return { error: 'Invalid admin user' }
      }

      return { user: { id: 'admin-user', username: 'admin', email: 'admin' } }
    } catch (error) {
      return { error: 'Invalid session token' }
    }
  } catch (error) {
    console.error('Auth verification error:', error)
    return { error: 'Authentication failed' }
  }
}

// Helper to create auth response
export function createAuthResponse(message: string, status: number = 401) {
  return NextResponse.json({ error: message }, { status })
}

// Helper to create session token
export function createSessionToken(email: string) {
  const tokenData = {
    email,
    timestamp: Date.now()
  }
  return Buffer.from(JSON.stringify(tokenData)).toString('base64')
}
