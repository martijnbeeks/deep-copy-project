import { NextRequest, NextResponse } from 'next/server'
import { getDeepCopyAccessToken } from '@/lib/auth/deepcopy-auth'
import { handleApiError, createValidationErrorResponse, createSuccessResponse } from '@/lib/middleware/error-handler'
import { checkJobCreationLimit } from '@/lib/services/billing'
import { getJobById } from '@/lib/db/queries'
import { query } from '@/lib/db/connection'
import { isDevMode } from '@/lib/utils/env'
import { logger } from '@/lib/utils/logger'

const DEEPCOPY_API_URL = 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { original_job_id, avatar_id, angle_id, swipe_file_ids, allowOverage } = body

    if (!original_job_id || !avatar_id || !angle_id) {
      return createValidationErrorResponse('original_job_id, avatar_id, and angle_id are required')
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

    // Check job credit limit (event-based) before generating pre-landers
    const limitCheck = await checkJobCreationLimit(job.user_id, 'pre_lander')
    if (!limitCheck.canCreate && !allowOverage) {
      if (limitCheck.overageConfirmationRequired) {
        return NextResponse.json(
          {
            error: 'Overage confirmation required',
            code: 'JOB_CREDITS_OVERAGE_CONFIRMATION_REQUIRED',
            message: limitCheck.reason,
            remaining: limitCheck.remaining ?? 0,
            required: limitCheck.required ?? 0,
            overageCredits: limitCheck.overageCredits ?? 0,
            overageCostPerCredit: limitCheck.overageCostPerCredit,
            overageCostTotal: limitCheck.overageCostTotal,
            currency: 'EUR',
          },
          { status: 402 }
        )
      }

      return NextResponse.json(
        { error: 'Job credit limit exceeded', message: limitCheck.reason },
        { status: 429 }
      )
    }

    // Use DeepCopy job ID (execution_id) if available, otherwise use job.id
    // Some jobs use DeepCopy job ID as primary key, others store it in execution_id
    const deepCopyJobId = job.execution_id || job.id
    logger.log(`🔧 Using DeepCopy job ID: ${deepCopyJobId} (local job ID: ${original_job_id}, execution_id: ${job.execution_id || 'none'})`)

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
        logger.log(`🔧 Request payload: original_job_id=${deepCopyJobId}, avatar_id=${avatar_id}, angle_id=${angle_id}`)

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
            original_job_id: deepCopyJobId, // Use DeepCopy job ID, not local database ID
            avatar_id,
            angle_id,
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

        // Record job credit event for pre_lander generation (event-based billing)
        try {
          const { JOB_CREDITS_BY_TYPE } = await import('@/lib/constants/job-credits')
          const { recordJobCreditEvent } = await import('@/lib/services/billing')

          // Use a unique synthetic job ID so each generation is billed separately
          const deepCopyJobId = job.execution_id || job.id
          const preLanderJobId = `prelander_${deepCopyJobId}_${angle_id}_${Date.now()}`

          await recordJobCreditEvent({
            userId: job.user_id,
            jobId: preLanderJobId,
            jobType: 'pre_lander',
            credits: JOB_CREDITS_BY_TYPE.pre_lander,
          })
        } catch (creditError: any) {
          logger.error(`❌ Failed to record pre_lander job credit event: ${creditError.message}`)
        }

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

