import { NextRequest } from 'next/server'
import { getDeepCopyAccessTokenResponse } from '@/lib/auth/deepcopy-auth'
import { handleApiError, createSuccessResponse } from '@/lib/middleware/error-handler'

export async function GET(_request: NextRequest) {
  try {
    const token = await getDeepCopyAccessTokenResponse()
    return createSuccessResponse({ 
      access_token: token.access_token, 
      expires_in: token.expires_in 
    })
  } catch (error) {
    return handleApiError(error)
  }
}


