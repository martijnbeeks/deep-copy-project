import { NextRequest } from 'next/server'
import { getDeepCopyAccessToken } from '@/lib/auth/deepcopy-auth'
import { handleApiError, createValidationErrorResponse, createSuccessResponse } from '@/lib/middleware/error-handler'
import { isDevMode } from '@/lib/utils/env'
import { logger } from '@/lib/utils/logger'

const DEEPCOPY_API_URL = 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return createValidationErrorResponse('URL is required')
    }

    // Determine endpoint based on environment
    const endpoint = isDevMode() ? 'dev/avatars/extract' : 'avatars/extract'
    const accessToken = await getDeepCopyAccessToken()

    logger.log(`🔧 ${isDevMode() ? 'DEV MODE' : 'PRODUCTION'}: Submitting avatar extraction to ${endpoint}`)

    // Submit avatar extraction job with cache-busting
    const response = await fetch(`${DEEPCOPY_API_URL}${endpoint}?t=${Date.now()}`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify({ url })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Avatar extraction API responded with status: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // Return the job ID for polling
    return createSuccessResponse({
      jobId: data.jobId,
      status: data.status,
      message: `Avatar extraction job submitted successfully${isDevMode() ? ' (DEV MODE - using mock data)' : ''}. Please poll the status endpoint to check progress.`
    })

  } catch (error) {
    return handleApiError(error)
  }
}