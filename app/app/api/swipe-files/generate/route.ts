import { NextRequest, NextResponse } from 'next/server'
import { getDeepCopyAccessToken } from '@/lib/auth/deepcopy-auth'
import { handleApiError, createValidationErrorResponse, createSuccessResponse } from '@/lib/middleware/error-handler'
import { checkAndIncrementUsage } from '@/lib/middleware/usage-limits'
import { getJobById } from '@/lib/db/queries'
import { query } from '@/lib/db/connection'
import { isDevMode } from '@/lib/utils/env'
import { logger } from '@/lib/utils/logger'

const DEEPCOPY_API_URL = 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { original_job_id, select_angle, swipe_file_ids } = body

    if (!original_job_id || !select_angle) {
      return createValidationErrorResponse('original_job_id and select_angle are required')
    }

    // Get the job to find the user
    const job = await getJobById(original_job_id)
    if (!job) {
      return createValidationErrorResponse('Job not found', 404)
    }

    // Get user from job
    const userResult = await query('SELECT * FROM users WHERE id = $1', [job.user_id])
    if (userResult.rows.length === 0) {
      return createValidationErrorResponse('User not found', 404)
    }
    const user = userResult.rows[0]

    // Check usage limits before generating pre-landers
    const usageCheck = await checkAndIncrementUsage(user, 'pre_lander')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Usage limit exceeded',
          message: usageCheck.error || 'You have reached your weekly limit for Pre-Lander actions.',
          currentUsage: usageCheck.currentUsage,
          limit: usageCheck.limit
        },
        { status: 429 } // Too Many Requests
      )
    }

    // Determine endpoint based on environment
    const endpoint = isDevMode() ? 'dev/swipe-files/generate' : 'swipe-files/generate'

    // Retry logic for connection timeouts
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get fresh access token for each attempt
        const accessToken = await getDeepCopyAccessToken()

        // Create AbortController with 60 second timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 seconds

        logger.log(`🔧 ${isDevMode() ? 'DEV MODE' : 'PRODUCTION'}: Submitting swipe file generation to ${endpoint} (attempt ${attempt})`)

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
          body: JSON.stringify({
            original_job_id,
            select_angle,
            ...(swipe_file_ids && swipe_file_ids.length > 0 && { swipe_file_ids })
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Swipe file generation failed: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        return createSuccessResponse(data)

      } catch (error: any) {
        lastError = error

        // Check if it's a timeout or connection error
        const isTimeout = error.name === 'AbortError' ||
          error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
          error.message?.includes('timeout') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ENOTFOUND')

        if (isTimeout && attempt < maxRetries) {
          logger.warn(`⚠️ Swipe file generation attempt ${attempt} timed out, retrying... (${maxRetries - attempt} attempts left)`)
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }

        // If it's not a timeout or we're out of retries, throw
        throw error
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Failed to generate swipe files after multiple attempts')

  } catch (error) {
    return handleApiError(error)
  }
}

