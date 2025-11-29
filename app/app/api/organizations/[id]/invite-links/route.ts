import { NextRequest, NextResponse } from 'next/server'
import { verifyOrganizationAdmin, createOrgAuthResponse } from '@/lib/auth/organization-auth'
import { getInviteLinksByOrganization, deleteInviteLink } from '@/lib/db/queries'
import { logger } from '@/lib/utils/logger'

// GET - List all invite links for an organization
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: organizationId } = params

    // Verify user is admin of organization
    const authResult = await verifyOrganizationAdmin(request, organizationId)
    if (authResult.error) {
      return createOrgAuthResponse(authResult.error)
    }

    const inviteLinks = await getInviteLinksByOrganization(organizationId)

    return NextResponse.json({ invite_links: inviteLinks })
  } catch (error) {
    logger.error('Error fetching invite links:', error)
    return NextResponse.json({ error: 'Failed to fetch invite links' }, { status: 500 })
  }
}

// DELETE - Delete an invite link for an organization
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: organizationId } = params
    const { searchParams } = new URL(request.url)
    const inviteLinkId = searchParams.get('id')

    if (!inviteLinkId) {
      return NextResponse.json({ error: 'Invite link ID is required' }, { status: 400 })
    }

    // Verify user is admin of organization
    const authResult = await verifyOrganizationAdmin(request, organizationId)
    if (authResult.error) {
      return createOrgAuthResponse(authResult.error)
    }

    // Verify the invite link belongs to this organization
    const inviteLinks = await getInviteLinksByOrganization(organizationId)
    const inviteLink = inviteLinks.find(link => link.id === inviteLinkId)

    if (!inviteLink) {
      return NextResponse.json({ error: 'Invite link not found or does not belong to this organization' }, { status: 404 })
    }

    const deleted = await deleteInviteLink(inviteLinkId)

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete invite link' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting invite link:', error)
    return NextResponse.json({ error: 'Failed to delete invite link' }, { status: 500 })
  }
}

