import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { checkUsageLimit } from '@/lib/middleware/usage-limits'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    const { searchParams } = new URL(request.url)
    const usageType = searchParams.get('type') as 'deep_research' | 'pre_lander' | null

    if (!usageType || (usageType !== 'deep_research' && usageType !== 'pre_lander')) {
      return createValidationErrorResponse('usage type must be "deep_research" or "pre_lander"')
    }

    const usageCheck = await checkUsageLimit(authResult.user, usageType)

    return createSuccessResponse({
      allowed: usageCheck.allowed,
      currentUsage: usageCheck.currentUsage,
      limit: usageCheck.limit,
      error: usageCheck.error
    })
  } catch (error) {
    return handleApiError(error)
  }
}

