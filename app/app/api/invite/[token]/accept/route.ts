import { NextRequest, NextResponse } from 'next/server'
import { getInviteLinkByToken, markInviteLinkAsUsed, createOrganization, createOrganizationMember, createUserWithUsername, getUserByEmail } from '@/lib/db/queries'
import { query } from '@/lib/db/connection'
import bcrypt from 'bcryptjs'

// POST - Accept invite and create org/user
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const startTime = Date.now()
  const { token } = params
  
  console.log('========================================')
  console.log('[INVITE_ACCEPT] POST request received', { 
    token, 
    timestamp: new Date().toISOString(),
    url: request.url
  })
  
  try {
    const body = await request.json()
    const { name, email, company_name, username, password } = body
    
    console.log('[INVITE_ACCEPT] Request body parsed', { 
      token,
      hasName: !!name,
      hasEmail: !!email,
      hasCompanyName: !!company_name,
      hasUsername: !!username,
      hasPassword: !!password
    })

    if (!token) {
      console.error('[INVITE_ACCEPT] Token is missing')
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Validate invite link
    console.log('[INVITE_ACCEPT] Fetching invite link from DB', { token })
    const inviteLink = await getInviteLinkByToken(token)
    if (!inviteLink) {
      console.error('[INVITE_ACCEPT] Invite link not found in database', { token })
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })
    }

    console.log('[INVITE_ACCEPT] Invite link found', { 
      token, 
      inviteId: inviteLink.id,
      inviteType: inviteLink.invite_type,
      usedAt: inviteLink.used_at,
      usedBy: inviteLink.used_by,
      expiresAt: inviteLink.expires_at
    })

    if (inviteLink.used_at) {
      console.error('[INVITE_ACCEPT] Invite link already used', { 
        token, 
        usedAt: inviteLink.used_at, 
        usedBy: inviteLink.used_by 
      })
      return NextResponse.json({ error: 'This invite link has already been used' }, { status: 400 })
    }

    const now = new Date()
    const expiresAt = new Date(inviteLink.expires_at)
    if (now > expiresAt) {
      console.error('[INVITE_ACCEPT] Invite link expired', { token, expiresAt: inviteLink.expires_at, now })
      return NextResponse.json({ error: 'This invite link has expired' }, { status: 400 })
    }

    // Validate required fields based on invite type
    if (inviteLink.invite_type === 'organization_creator') {
      if (!name || !email || !company_name || !password) {
        console.error('[INVITE_ACCEPT] Missing required fields for organization_creator', { name: !!name, email: !!email, company_name: !!company_name, password: !!password })
        return NextResponse.json({ error: 'Name, email, company name, and password are required' }, { status: 400 })
      }
      if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
      }
    } else if (inviteLink.invite_type === 'staff_member') {
      if (!name || !email || !username || !password) {
        console.error('[INVITE_ACCEPT] Missing required fields for staff_member', { name: !!name, email: !!email, username: !!username, password: !!password })
        return NextResponse.json({ error: 'Name, email, username, and password are required' }, { status: 400 })
      }
    }

    // Check if user already exists
    console.log('[INVITE_ACCEPT] Checking if user exists', { email: email.toLowerCase().trim() })
    const existingUser = await getUserByEmail(email.toLowerCase().trim())
    if (existingUser) {
      console.error('[INVITE_ACCEPT] User already exists', { email, existingUserId: existingUser.id })
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 })
    }

    // Create user
    let user
    if (inviteLink.invite_type === 'organization_creator') {
      console.log('[INVITE_ACCEPT] Creating organization creator user', { email, name })
      // Hash the password provided by the user
      const passwordHash = await bcrypt.hash(password, 10)
      const result = await query(
        'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
        [email.toLowerCase().trim(), passwordHash, name.trim()]
      )
      user = result.rows[0]
      console.log('[INVITE_ACCEPT] User created successfully', { userId: user.id, email: user.email })

      // Create organization
      console.log('[INVITE_ACCEPT] Creating organization', { companyName: company_name, userId: user.id })
      const organization = await createOrganization(company_name.trim(), user.id)
      console.log('[INVITE_ACCEPT] Organization created successfully', { orgId: organization.id, orgName: organization.name })

      // Add user as admin of organization
      console.log('[INVITE_ACCEPT] Adding user as organization member', { orgId: organization.id, userId: user.id })
      await createOrganizationMember({
        organization_id: organization.id,
        user_id: user.id,
        role: 'admin',
        status: 'approved',
        invited_by: inviteLink.created_by
      })
      console.log('[INVITE_ACCEPT] User added as organization member', { orgId: organization.id, userId: user.id })

      // Mark invite as used
      console.log('[INVITE_ACCEPT] BEFORE markInviteLinkAsUsed', { token, userId: user.id })
      const markedAsUsed = await markInviteLinkAsUsed(token, user.id)
      console.log('[INVITE_ACCEPT] AFTER markInviteLinkAsUsed', { token, userId: user.id, markedAsUsed })
      
      if (!markedAsUsed) {
        console.error('[INVITE_ACCEPT] markInviteLinkAsUsed returned false', { token, userId: user.id })
        // Verify if it was already marked (race condition check)
        const verifyInvite = await getInviteLinkByToken(token)
        console.log('[INVITE_ACCEPT] Verification after failed mark', { 
          token, 
          verifyInvite: verifyInvite ? {
            id: verifyInvite.id,
            usedAt: verifyInvite.used_at,
            usedBy: verifyInvite.used_by
          } : null
        })
        if (!verifyInvite || !verifyInvite.used_at) {
          console.error('[INVITE_ACCEPT] Invite was NOT marked and verification confirms it', { token, userId: user.id })
          throw new Error('Failed to mark invite link as used')
        } else {
          console.log('[INVITE_ACCEPT] Invite was already marked (race condition)', { token, usedAt: verifyInvite.used_at })
        }
      } else {
        // Verify the invite was actually marked
        const verifyInvite = await getInviteLinkByToken(token)
        console.log('[INVITE_ACCEPT] Verification after successful mark', { 
          token, 
          verifyInvite: verifyInvite ? {
            id: verifyInvite.id,
            usedAt: verifyInvite.used_at,
            usedBy: verifyInvite.used_by
          } : null
        })
      }

      const duration = Date.now() - startTime
      console.log('[INVITE_ACCEPT] SUCCESS - Organization creator flow completed', { 
        token, 
        userId: user.id, 
        orgId: organization.id,
        duration: `${duration}ms` 
      })
      console.log('========================================')

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
      console.log('[INVITE_ACCEPT] Creating staff member user', { email, name, username })
      user = await createUserWithUsername(
        email.toLowerCase().trim(),
        password,
        name.trim(),
        username.trim()
      )
      console.log('[INVITE_ACCEPT] Staff user created successfully', { userId: user.id, email: user.email, username: user.username })

      if (!inviteLink.organization_id) {
        console.error('[INVITE_ACCEPT] Organization ID missing from invite link', { token })
        return NextResponse.json({ error: 'Organization ID missing from invite link' }, { status: 400 })
      }

      // Add user as pending member
      console.log('[INVITE_ACCEPT] Adding staff user as organization member', { orgId: inviteLink.organization_id, userId: user.id })
      await createOrganizationMember({
        organization_id: inviteLink.organization_id,
        user_id: user.id,
        role: 'normal_user', // Default role, admin can change on approval
        status: 'pending',
        invited_by: inviteLink.created_by
      })
      console.log('[INVITE_ACCEPT] Staff user added as organization member', { orgId: inviteLink.organization_id, userId: user.id })

      // Mark invite as used
      console.log('[INVITE_ACCEPT] BEFORE markInviteLinkAsUsed', { token, userId: user.id })
      const markedAsUsed = await markInviteLinkAsUsed(token, user.id)
      console.log('[INVITE_ACCEPT] AFTER markInviteLinkAsUsed', { token, userId: user.id, markedAsUsed })
      
      if (!markedAsUsed) {
        console.error('[INVITE_ACCEPT] markInviteLinkAsUsed returned false', { token, userId: user.id })
        // Verify if it was already marked (race condition check)
        const verifyInvite = await getInviteLinkByToken(token)
        console.log('[INVITE_ACCEPT] Verification after failed mark', { 
          token, 
          verifyInvite: verifyInvite ? {
            id: verifyInvite.id,
            usedAt: verifyInvite.used_at,
            usedBy: verifyInvite.used_by
          } : null
        })
        if (!verifyInvite || !verifyInvite.used_at) {
          console.error('[INVITE_ACCEPT] Invite was NOT marked and verification confirms it', { token, userId: user.id })
          throw new Error('Failed to mark invite link as used')
        } else {
          console.log('[INVITE_ACCEPT] Invite was already marked (race condition)', { token, usedAt: verifyInvite.used_at })
        }
      } else {
        // Verify the invite was actually marked
        const verifyInvite = await getInviteLinkByToken(token)
        console.log('[INVITE_ACCEPT] Verification after successful mark', { 
          token, 
          verifyInvite: verifyInvite ? {
            id: verifyInvite.id,
            usedAt: verifyInvite.used_at,
            usedBy: verifyInvite.used_by
          } : null
        })
      }

      const duration = Date.now() - startTime
      console.log('[INVITE_ACCEPT] SUCCESS - Staff member flow completed', { 
        token, 
        userId: user.id, 
        duration: `${duration}ms` 
      })
      console.log('========================================')

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
    const duration = Date.now() - startTime
    console.error('[INVITE_ACCEPT] ERROR caught in catch block', { 
      token, 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${duration}ms`
    })
    console.log('========================================')
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
  }
}

