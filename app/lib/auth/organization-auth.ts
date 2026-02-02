import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationMember } from '@/lib/db/queries'
import { getUserByEmail } from '@/lib/db/queries'

// Verify user is an admin of the organization
export async function verifyOrganizationAdmin(request: NextRequest, organizationId: string): Promise<{ error?: string; user?: any; member?: any }> {
  try {
    // Get user from auth header (similar to user-auth.ts)
    const authHeader = request.headers.get('authorization')
    const userEmail = authHeader?.replace('Bearer ', '') || null

    if (!userEmail) {
      return { error: 'No authorization header provided' }
    }

    const user = await getUserByEmail(userEmail)
    if (!user) {
      return { error: 'User not found' }
    }

    const member = await getOrganizationMember(organizationId, user.id)
    if (!member || member.status !== 'approved' || member.role !== 'admin') {
      return { error: 'User is not an admin of this organization' }
    }

    return { user, member }
  } catch (error) {
    return { error: 'Authentication failed' }
  }
}

export function createOrgAuthResponse(message: string, status: number = 403) {
  return NextResponse.json({ error: message }, { status })
}

