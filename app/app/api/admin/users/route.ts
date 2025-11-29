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
      SELECT 
        u.id, 
        u.email, 
        u.name, 
        u.created_at, 
        u.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', o.id,
              'name', o.name,
              'role', om.role,
              'status', om.status
            ) ORDER BY o.created_at
          ) FILTER (WHERE o.id IS NOT NULL),
          '[]'::json
        ) as organizations
      FROM users u
      LEFT JOIN organization_members om ON u.id = om.user_id
      LEFT JOIN organizations o ON om.organization_id = o.id
      GROUP BY u.id, u.email, u.name, u.created_at, u.updated_at
      ORDER BY u.created_at DESC
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

    // Check if user has any jobs
    const jobsResult = await query('SELECT COUNT(*) as count FROM jobs WHERE user_id = $1', [userId])
    const jobCount = parseInt(jobsResult.rows[0].count)

    if (jobCount > 0) {
      return NextResponse.json({
        error: `Cannot delete user: User has ${jobCount} job(s) associated with them. Please delete the jobs first or contact support.`
      }, { status: 400 })
    }

    // Delete user (no related records to worry about)
    await query('DELETE FROM users WHERE id = $1', [userId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
