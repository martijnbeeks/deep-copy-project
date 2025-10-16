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

    // Check if admin user exists (using username instead of email)
    const adminUser = await query('SELECT * FROM admin_users WHERE username = $1', [email])
    if (adminUser.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, adminUser.rows[0].password_hash)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Create session token
    const sessionToken = createSessionToken(email)
    
    return NextResponse.json({ 
      success: true,
      user: {
        id: adminUser.rows[0].id,
        username: adminUser.rows[0].username,
        email: email // Use the provided email for consistency
      },
      sessionToken
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
