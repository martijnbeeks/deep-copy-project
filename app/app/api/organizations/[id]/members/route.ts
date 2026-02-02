import { NextRequest, NextResponse } from 'next/server'
import { verifyOrganizationAdmin, createOrgAuthResponse } from '@/lib/auth/organization-auth'
import { getOrganizationMembers } from '@/lib/db/queries'

// GET - List organization members
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

    const members = await getOrganizationMembers(organizationId)

    return NextResponse.json({ members })
  } catch (error) {
    console.error('Error fetching organization members:', error)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}

