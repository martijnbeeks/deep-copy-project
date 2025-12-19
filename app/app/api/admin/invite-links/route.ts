import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAuth, createAuthResponse } from '@/lib/auth/admin-auth'
import { createInviteLink, getInviteLinksByCreator, deleteInviteLink } from '@/lib/db/queries'
import { query } from '@/lib/db/connection'
import { InviteType } from '@/lib/db/types'
import { logger } from '@/lib/utils/logger'

// Helper to get admin user ID (hardcoded admin email)
const getAdminUserId = async (): Promise<string | null> => {
  // Since admin is hardcoded, we need to find or create an admin user
  // Check if there's a user with email 'admin'
  const result = await query('SELECT id FROM users WHERE email = $1', ['admin'])
  if (result.rows.length > 0) {
    return result.rows[0].id
  }
  // If no admin user exists, create one (for first-time setup)
  // This is a one-time setup - in production, admin user should already exist
  const createResult = await query(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
    ['admin', '$2a$10$placeholder', 'Admin User']
  )
  return createResult.rows[0].id
}

// POST - Create invite link
export async function POST(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const { waitlist_email, expiration_hours, expiration_days } = await request.json()

    // Calculate expiration
    let expiresAt: Date
    if (expiration_days) {
      expiresAt = new Date(Date.now() + expiration_days * 24 * 60 * 60 * 1000)
    } else if (expiration_hours) {
      expiresAt = new Date(Date.now() + expiration_hours * 60 * 60 * 1000)
    } else {
      // Default to 7 days
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }

    // Waitlist email is optional - if provided, verify it exists in waitlist
    let waitlistEmailValue: string | null = null
    if (waitlist_email) {
      const waitlistCheck = await query('SELECT id FROM waitlist WHERE email = $1', [waitlist_email.toLowerCase().trim()])
      if (waitlistCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Email not found in waitlist' }, { status: 404 })
      }
      waitlistEmailValue = waitlist_email.toLowerCase().trim()
    }

    const adminUserId = await getAdminUserId()
    if (!adminUserId) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 500 })
    }

    const inviteLink = await createInviteLink({
      created_by: adminUserId,
      invite_type: 'organization_creator',
      waitlist_email: waitlistEmailValue,
      expires_at: expiresAt
    })

    return NextResponse.json({
      invite_link: inviteLink,
      invite_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${inviteLink.token}`
    })
  } catch (error) {
    logger.error('Error creating invite link:', error)
    return NextResponse.json({ error: 'Failed to create invite link' }, { status: 500 })
  }
}

// GET - List all invite links
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const adminUserId = await getAdminUserId()
    if (!adminUserId) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 500 })
    }

    // Join with users table to get email of user who used the invite
    const result = await query(
      `SELECT 
        il.*,
        u.email as used_by_email
      FROM invite_links il
      LEFT JOIN users u ON il.used_by = u.id
      WHERE il.created_by = $1 
      ORDER BY il.created_at DESC`,
      [adminUserId]
    )
    
    const inviteLinks = result.rows.map(row => ({
      id: row.id,
      token: row.token,
      invite_type: row.invite_type,
      waitlist_email: row.waitlist_email,
      expires_at: row.expires_at,
      used_at: row.used_at,
      used_by: row.used_by,
      used_by_email: row.used_by_email, // Add this field
      created_at: row.created_at
    }))
    
    return NextResponse.json({ invite_links: inviteLinks })
  } catch (error) {
    logger.error('Error fetching invite links:', error)
    return NextResponse.json({ error: 'Failed to fetch invite links' }, { status: 500 })
  }
}

// DELETE - Delete invite link
export async function DELETE(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const { searchParams } = new URL(request.url)
    const inviteLinkId = searchParams.get('id')
    
    if (!inviteLinkId) {
      return NextResponse.json({ error: 'Invite link ID is required' }, { status: 400 })
    }

    const deleted = await deleteInviteLink(inviteLinkId)
    
    if (!deleted) {
      return NextResponse.json({ error: 'Invite link not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting invite link:', error)
    return NextResponse.json({ error: 'Failed to delete invite link' }, { status: 500 })
  }
}

