import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail } from '@/lib/db/queries'
import { query } from '@/lib/db/connection'

// GET - Get all organizations where user is an admin
export async function GET(request: NextRequest) {
  try {
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    const userEmail = authHeader?.replace('Bearer ', '') || null

    if (!userEmail) {
      return NextResponse.json({ error: 'No authorization provided' }, { status: 401 })
    }

    const user = await getUserByEmail(userEmail)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all organizations where user is an approved admin
    const result = await query(
      `SELECT o.* 
       FROM organizations o
       INNER JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = $1 
         AND om.status = 'approved' 
         AND om.role = 'admin'
       ORDER BY o.created_at DESC`,
      [user.id]
    )

    return NextResponse.json({ organizations: result.rows })
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
  }
}

