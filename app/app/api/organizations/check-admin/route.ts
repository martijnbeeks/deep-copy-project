import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, getOrganizationMember } from '@/lib/db/queries'
import { query } from '@/lib/db/connection'

// GET - Check if user is an admin of any organization
export async function GET(request: NextRequest) {
  try {
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    const userEmail = authHeader?.replace('Bearer ', '') || null

    if (!userEmail) {
      return NextResponse.json({ isAdmin: false })
    }

    const user = await getUserByEmail(userEmail)
    if (!user) {
      return NextResponse.json({ isAdmin: false })
    }

    // Check if user is an admin of any organization
    const result = await query(
      `SELECT COUNT(*) as count
       FROM organization_members
       WHERE user_id = $1 
         AND status = 'approved' 
         AND role = 'admin'`,
      [user.id]
    )

    const isAdmin = parseInt(result.rows[0]?.count || '0') > 0

    return NextResponse.json({ isAdmin })
  } catch (error) {
    console.error('Error checking admin status:', error)
    return NextResponse.json({ isAdmin: false })
  }
}

