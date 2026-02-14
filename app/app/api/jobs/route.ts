import { NextRequest, NextResponse } from 'next/server'
import { getJobsByUserId, createJob, updateJobStatus, createResult, updateJobScreenshot, populateEditableProductDetailsFromV2 } from '@/lib/db/queries'
import { deepCopyClient } from '@/lib/clients/deepcopy-client'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { checkJobCreationLimit } from '@/lib/services/billing'
import { logger } from '@/lib/utils/logger'
import { transformV2ToExistingSchema } from '@/lib/utils/v2-data-transformer'
import { isDevMode } from '@/lib/utils/env'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined

    const jobs = await getJobsByUserId(authResult.user.id, { status, search })

    return createSuccessResponse({ jobs })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      title,
      sales_page_url,
      research_requirements,
      gender,
      location,
      advertorial_type,
      notification_email,
      allowOverage
    } = await request.json()

    if (!title) {
      return createValidationErrorResponse('Title is required')
    }

    if (!sales_page_url) {
      return createValidationErrorResponse('Sales page URL is required')
    }

    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }
    const user = authResult.user

    // Check for duplicate jobs (same title created within last 30 seconds)
    const { checkDuplicateJob } = await import('@/lib/db/queries')
    const duplicateJob = await checkDuplicateJob(user.id, title)

    if (duplicateJob) {
      return NextResponse.json(
        {
          error: 'Duplicate job detected',
          message: `A job with the title "${title}" was created recently. Please wait a moment before creating another job with the same title.`,
          duplicateJobId: duplicateJob.id
        },
        { status: 409 } // Conflict status
      )
    }

    // Check job credit limit (event-based) before creating V2 research job
    const limitCheck = await checkJobCreationLimit(user.id, 'deep_research')
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

    // Submit V2 unified research to DeepCopy API
    let deepCopyJobId: string
    try {
      // Build callback URL so Lambda can notify us when the job finishes
      const appUrl = process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'http://localhost:3000'
      const callbackUrl = `${appUrl}/api/webhooks/job-complete`

      const v2Payload = {
        sales_page_url: sales_page_url,
        project_name: title,
        advertorial_type: advertorial_type || 'Listicle',
        research_requirements: research_requirements || undefined,
        gender: gender || undefined,
        location: location || undefined,
        notification_email: notification_email || undefined,
        callback_url: callbackUrl,
      }

      const deepCopyResponse = await deepCopyClient.submitV2Research(v2Payload)
      deepCopyJobId = deepCopyResponse.jobId

    } catch (apiError) {
      logger.error('❌ DeepCopy V2 API Error:', apiError)
      return NextResponse.json(
        { error: 'Failed to submit V2 research to DeepCopy API', details: apiError instanceof Error ? apiError.message : String(apiError) },
        { status: 500 }
      )
    }

    // Create job in database with the DeepCopy job ID as the primary ID
    // Avatars will be populated when V2 results are received
    const job = await createJob({
      user_id: user.id,
      title,
      brand_info: '', // Not used in V2
      sales_page_url,
      template_id: undefined, // No template selection at creation
      advertorial_type: advertorial_type || 'advertorial', // Default type for database constraint
      target_approach: 'v2', // Mark as V2 job
      avatars: [], // Will be populated from V2 results
      execution_id: deepCopyJobId,
      custom_id: deepCopyJobId, // Use DeepCopy job ID as the primary key
      screenshot: undefined, // No screenshot in V2 flow
      // Store V2 form fields
      research_requirements: research_requirements || undefined,
      target_gender: gender || undefined,
      target_location: location || undefined,
      form_advertorial_type: advertorial_type || 'Listicle'
    })

    // Update job status to processing
    await updateJobStatus(job.id, 'processing')

    // Immediately check the V2 job status to get initial progress
    try {
      const statusResponse = await deepCopyClient.getV2Status(deepCopyJobId)

      if (statusResponse.status === 'SUCCEEDED') {
        // V2 job completed immediately - get results and store them
        const result = await deepCopyClient.getV2Result(deepCopyJobId)
        await storeV2JobResults(job.id, result, deepCopyJobId)
        await updateJobStatus(job.id, 'completed', 100)

        // Record job credit event (event-based billing)
        try {
          const { recordJobCreditEvent } = await import('@/lib/services/billing')
          const { JOB_CREDITS_BY_TYPE } = await import('@/lib/constants/job-credits')
          await recordJobCreditEvent({
            userId: user.id,
            jobId: job.id,
            jobType: 'deep_research',
            credits: JOB_CREDITS_BY_TYPE.deep_research,
          })
        } catch (creditErr) {
          logger.error('❌ Failed to record job credit event:', creditErr)
        }

      } else if (statusResponse.status === 'FAILED') {
        // Job failed immediately
        await updateJobStatus(job.id, 'failed')

      } else if (['RUNNING', 'SUBMITTED', 'PENDING'].includes(statusResponse.status)) {
        // Job is processing - update progress
        const progress = statusResponse.status === 'SUBMITTED' ? 25 :
          statusResponse.status === 'RUNNING' ? 50 : 30
        await updateJobStatus(job.id, 'processing', progress)
      }
    } catch (statusError) {
      // Continue with job creation even if status check fails
      logger.error('Error checking V2 job status:', statusError)
    }

    return createSuccessResponse(job)
  } catch (error) {
    return handleApiError(error)
  }
}

// Strip null bytes from strings/objects/arrays (used in dev mode to avoid DB errors)
function stripNulls(value: any): any {
  if (typeof value === 'string') return value.replace(/\u0000/g, '')
  if (Array.isArray(value)) return value.map(stripNulls)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripNulls(v)]))
  }
  return value
}

// Store V2 job results in database
async function storeV2JobResults(localJobId: string, result: any, deepCopyJobId: string) {
  try {
    const sanitizedResult = isDevMode() ? stripNulls(result) : result

    // Transform V2 avatars to existing schema format
    const transformedAvatars = transformV2ToExistingSchema(sanitizedResult)
    const sanitizedAvatars = isDevMode() ? stripNulls(transformedAvatars) : transformedAvatars

    // Update job with transformed avatars
    const { updateJobAvatars } = await import('@/lib/db/queries')
    await updateJobAvatars(localJobId, sanitizedAvatars)

    // Persist product image (DeepCopy screenshot) for use in previews
    const productImage = sanitizedResult?.results?.product_image || sanitizedResult?.product_image
    if (productImage && typeof productImage === 'string') {
      await updateJobScreenshot(localJobId, productImage)
    }

    // Store the complete JSON result as metadata
    await createResult(localJobId, '', {
      deepcopy_job_id: deepCopyJobId,
      full_result: sanitizedResult,
      project_name: sanitizedResult.project_name,
      timestamp_iso: sanitizedResult.timestamp_iso,
      job_id: sanitizedResult.job_id,
      api_version: sanitizedResult.api_version || 'v2',
      generated_at: new Date().toISOString()
    })

    // Automatically populate editable product details from V2 response
    await populateEditableProductDetailsFromV2(localJobId, sanitizedResult)

  } catch (error) {
    logger.error('Error storing V2 job results:', error)
    throw error
  }
}

// Store job results in database (V1 - kept for backward compatibility)
async function storeJobResults(localJobId: string, result: any, deepCopyJobId: string) {
  try {
    // Store the complete JSON result as metadata
    await createResult(localJobId, '', {
      deepcopy_job_id: deepCopyJobId,
      full_result: result,
      project_name: result.project_name,
      timestamp_iso: result.timestamp_iso,
      job_id: result.job_id,
      generated_at: new Date().toISOString()
    })
  } catch (error) {
    throw error
  }
}

