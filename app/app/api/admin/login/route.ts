import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import bcrypt from 'bcryptjs'
import { createSessionToken } from '@/lib/auth/admin-auth'

// POST login endpoint
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Hardcoded admin credentials for production
    const ADMIN_USERNAME = 'admin'
    const ADMIN_PASSWORD = 'admin123'
    
    // Simple credential check
    if (email !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Create session token
    const sessionToken = createSessionToken(email)
    
    return NextResponse.json({ 
      success: true,
      user: {
        id: 'admin-user',
        username: ADMIN_USERNAME,
        email: email
      },
      sessionToken
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
