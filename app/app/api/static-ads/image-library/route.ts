import { NextRequest, NextResponse } from 'next/server'
import { getImageLibrary } from '@/lib/db/queries'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse } from '@/lib/middleware/error-handler'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    const images = await getImageLibrary()

    return createSuccessResponse({ images })
  } catch (error) {
    return handleApiError(error)
  }
}

