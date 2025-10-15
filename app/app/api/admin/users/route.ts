import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import bcrypt from 'bcryptjs'
import { verifyAdminAuth, createAuthResponse } from '@/lib/auth/admin-auth'

// GET all users
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const users = await query(`
      SELECT id, email, name, created_at, updated_at 
      FROM users 
      ORDER BY created_at DESC
    `)
    
    return NextResponse.json({ users: users.rows })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// POST create new user
export async function POST(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const { email, password, name } = await request.json()
    
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 })
    }
    
    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email])
    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 })
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)
    
    // Create user
    const result = await query(`
      INSERT INTO users (email, password_hash, name) 
      VALUES ($1, $2, $3) 
      RETURNING id, email, name, created_at
    `, [email, passwordHash, name])
    
    return NextResponse.json({ user: result.rows[0] })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}

// DELETE user
export async function DELETE(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    // Delete user (cascade will handle related records)
    await query('DELETE FROM users WHERE id = $1', [userId])
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
