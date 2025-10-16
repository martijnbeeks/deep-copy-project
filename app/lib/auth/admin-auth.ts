import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

// Simple admin authentication middleware
export async function verifyAdminAuth(request: NextRequest) {
  try {
    // Check for session token in headers instead of Basic Auth
    const sessionToken = request.headers.get('x-admin-session')
    
    if (!sessionToken) {
      return { error: 'No session token provided' }
    }

    // In a real app, you'd validate the session token against a sessions table
    // For now, we'll use a simple approach with the token containing user info
    try {
      const decodedToken = JSON.parse(Buffer.from(sessionToken, 'base64').toString())
      const { email, timestamp } = decodedToken
      
      // Check if token is not too old (24 hours)
      const tokenAge = Date.now() - timestamp
      if (tokenAge > 24 * 60 * 60 * 1000) {
        return { error: 'Session expired' }
      }

      // Verify admin user still exists
      const adminUser = await query('SELECT * FROM admin_users WHERE username = $1', [email])
      if (adminUser.rows.length === 0) {
        return { error: 'Admin user not found' }
      }

      return { user: adminUser.rows[0] }
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
