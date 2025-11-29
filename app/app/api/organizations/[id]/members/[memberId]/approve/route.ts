import { NextRequest, NextResponse } from 'next/server'
import { verifyOrganizationAdmin, createOrgAuthResponse } from '@/lib/auth/organization-auth'
import { updateOrganizationMemberStatus, getOrganizationMember } from '@/lib/db/queries'
import { UserRole } from '@/lib/db/types'

// PUT - Approve and assign role to staff member
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const { id: organizationId, memberId } = params
    const { role } = await request.json()

    // Verify user is admin of organization
    const authResult = await verifyOrganizationAdmin(request, organizationId)
    if (authResult.error) {
      return createOrgAuthResponse(authResult.error)
    }

    if (!role || (role !== 'admin' && role !== 'normal_user')) {
      return NextResponse.json({ error: 'Valid role (admin or normal_user) is required' }, { status: 400 })
    }

    // Verify member exists and belongs to organization
    const { query } = await import('@/lib/db/connection')
    const memberResult = await query(
      'SELECT * FROM organization_members WHERE id = $1 AND organization_id = $2',
      [memberId, organizationId]
    )

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const updatedMember = await updateOrganizationMemberStatus(memberId, 'approved', role as UserRole)

    if (!updatedMember) {
      return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
    }

    return NextResponse.json({ member: updatedMember })
  } catch (error) {
    console.error('Error approving member:', error)
    return NextResponse.json({ error: 'Failed to approve member' }, { status: 500 })
  }
}

