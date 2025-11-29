import { NextRequest, NextResponse } from 'next/server'
import { verifyOrganizationAdmin, createOrgAuthResponse } from '@/lib/auth/organization-auth'
import { createInviteLink, getOrganizationById } from '@/lib/db/queries'

// POST - Invite staff member
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: organizationId } = params
    const { expiration_hours, expiration_days } = await request.json()

    // Verify user is admin of organization
    const authResult = await verifyOrganizationAdmin(request, organizationId)
    if (authResult.error) {
      return createOrgAuthResponse(authResult.error)
    }

    // Verify organization exists
    const organization = await getOrganizationById(organizationId)
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

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

    const inviteLink = await createInviteLink({
      created_by: authResult.user!.id,
      invite_type: 'staff_member',
      organization_id: organizationId,
      expires_at: expiresAt
    })

    return NextResponse.json({
      invite_link: inviteLink,
      invite_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${inviteLink.token}`
    })
  } catch (error) {
    console.error('Error creating staff invite:', error)
    return NextResponse.json({ error: 'Failed to create invite link' }, { status: 500 })
  }
}

