import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, validatePassword } from '@/lib/db/queries'
import { query } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const user = await getUserByEmail(email)
    if (!user || !user.password_hash) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const isValidPassword = await validatePassword(password, user.password_hash)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check if user is a member of any organization
    const memberCheck = await query(
      `SELECT status 
       FROM organization_members 
       WHERE user_id = $1`,
      [user.id]
    )

    // If user is a member of any organization, they must have at least one approved membership
    if (memberCheck.rows.length > 0) {
      const hasApprovedMembership = memberCheck.rows.some(
        (row) => row.status === 'approved'
      )

      if (!hasApprovedMembership) {
        return NextResponse.json(
          {
            error: 'Your account is pending for approval. Please wait for an administrator to approve your membership before you can sign in.'
          },
          { status: 403 }
        )
      }
    }

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user

    // Check if user is an admin of any organization (quick check during login)
    let isAdmin = false
    try {
      const adminCheck = await query(
        `SELECT COUNT(*) as count
         FROM organization_members
         WHERE user_id = $1 
           AND status = 'approved' 
           AND role = 'admin'`,
        [user.id]
      )
      isAdmin = parseInt(adminCheck.rows[0]?.count || '0') > 0
    } catch (error) {
      // If admin check fails, default to false (non-critical)
      // Admin status check failure is not critical for login
    }

    const response = NextResponse.json({
      user: userWithoutPassword,
      isAdmin // Include admin status in login response
    })

    // Add cache-busting headers
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
