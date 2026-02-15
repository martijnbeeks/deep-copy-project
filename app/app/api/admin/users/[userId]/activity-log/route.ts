import { NextRequest, NextResponse } from 'next/server'
import { getUserActivityLog } from '@/lib/db/queries'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse } from '@/lib/middleware/error-handler'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500) // Max 500 for performance

    // Get activity log for the specified user
    const activities = await getUserActivityLog(params.userId, limit)

    return createSuccessResponse({
      activities,
      total: activities.length,
      userId: params.userId
    })
  } catch (error) {
    return handleApiError(error)
  }
}
