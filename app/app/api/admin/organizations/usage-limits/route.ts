import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAuth, createAuthResponse } from '@/lib/auth/admin-auth'
import { getAllOrganizationsWithLimits } from '@/lib/db/queries'
import { handleApiError } from '@/lib/middleware/error-handler'

// GET all organizations with their usage limits and current usage
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const organizations = await getAllOrganizationsWithLimits()
    return NextResponse.json({ organizations })
  } catch (error) {
    return handleApiError(error)
  }
}

