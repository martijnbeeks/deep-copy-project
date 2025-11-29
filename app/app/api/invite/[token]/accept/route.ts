import { NextRequest, NextResponse } from 'next/server'
import { getInviteLinkByToken, markInviteLinkAsUsed, createOrganization, createOrganizationMember, createUserWithUsername, getUserByEmail } from '@/lib/db/queries'
import { query } from '@/lib/db/connection'
import bcrypt from 'bcryptjs'

// POST - Accept invite and create org/user
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const { name, email, company_name, username, password } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Validate invite link
    const inviteLink = await getInviteLinkByToken(token)
    if (!inviteLink) {
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })
    }

    if (inviteLink.used_at) {
      return NextResponse.json({ error: 'This invite link has already been used' }, { status: 400 })
    }

    const now = new Date()
    const expiresAt = new Date(inviteLink.expires_at)
    if (now > expiresAt) {
      return NextResponse.json({ error: 'This invite link has expired' }, { status: 400 })
    }

    // Validate required fields based on invite type
    if (inviteLink.invite_type === 'organization_creator') {
      if (!name || !email || !company_name || !password) {
        return NextResponse.json({ error: 'Name, email, company name, and password are required' }, { status: 400 })
      }
      if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
      }
    } else if (inviteLink.invite_type === 'staff_member') {
      if (!name || !email || !username || !password) {
        return NextResponse.json({ error: 'Name, email, username, and password are required' }, { status: 400 })
      }
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email.toLowerCase().trim())
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 })
    }

    // Create user
    let user
    if (inviteLink.invite_type === 'organization_creator') {
      // Hash the password provided by the user
      const passwordHash = await bcrypt.hash(password, 10)
      const result = await query(
        'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
        [email.toLowerCase().trim(), passwordHash, name.trim()]
      )
      user = result.rows[0]

      // Create organization
      const organization = await createOrganization(company_name.trim(), user.id)

      // Add user as admin of organization
      await createOrganizationMember({
        organization_id: organization.id,
        user_id: user.id,
        role: 'admin',
        status: 'approved',
        invited_by: inviteLink.created_by
      })

      // Mark invite as used
      await markInviteLinkAsUsed(token, user.id)

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        organization: {
          id: organization.id,
          name: organization.name
        }
      })
    } else {
      // Staff member flow
      user = await createUserWithUsername(
        email.toLowerCase().trim(),
        password,
        name.trim(),
        username.trim()
      )

      if (!inviteLink.organization_id) {
        return NextResponse.json({ error: 'Organization ID missing from invite link' }, { status: 400 })
      }

      // Add user as pending member
      await createOrganizationMember({
        organization_id: inviteLink.organization_id,
        user_id: user.id,
        role: 'normal_user', // Default role, admin can change on approval
        status: 'pending',
        invited_by: inviteLink.created_by
      })

      // Mark invite as used
      await markInviteLinkAsUsed(token, user.id)

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username
        },
        message: 'Account created. Waiting for admin approval.'
      })
    }
  } catch (error) {
    console.error('Error accepting invite:', error)
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
  }
}

