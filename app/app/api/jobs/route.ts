import { NextRequest, NextResponse } from 'next/server'
import { getJobsByUserId, createJob, updateJobStatus, createResult } from '@/lib/db/queries'
import { deepCopyClient } from '@/lib/clients/deepcopy-client'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { logger } from '@/lib/utils/logger'
import { isDevMode } from '@/lib/utils/env'
import { getDeepCopyAccessToken } from '@/lib/auth/deepcopy-auth'

const DEEPCOPY_API_URL = 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/'

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
      brand_info,
      sales_page_url,
      target_approach,
      avatars,
      product_image
    } = await request.json()

    if (!title) {
      return createValidationErrorResponse('Title is required')
    }

    if (!target_approach) {
      return createValidationErrorResponse('Target approach is required')
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

    // Get selected avatars (where is_researched === true) for DeepCopy API
    const selectedAvatars = avatars?.filter((a: any) => a.is_researched === true) || []

    // Submit job to DeepCopy API first to get the job ID
    // Use /dev/jobs in dev mode, /jobs in prod
    let deepCopyJobId: string
    try {
      const jobPayload: any = {
        sales_page_url: sales_page_url || '',
        project_name: title
      }

      if (selectedAvatars.length > 0) {
        jobPayload.customer_avatars = selectedAvatars
      }

      // Determine endpoint based on environment
      const endpoint = isDevMode() ? 'dev/jobs' : 'jobs'
      const accessToken = await getDeepCopyAccessToken()

      logger.log(`🔧 ${isDevMode() ? 'DEV MODE' : 'PRODUCTION'}: Submitting job to ${endpoint}`)

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
        body: JSON.stringify(jobPayload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`DeepCopy API responded with status: ${response.status} - ${errorText}`)
      }

      const deepCopyResponse = await response.json()
      deepCopyJobId = deepCopyResponse.jobId

    } catch (apiError) {
      logger.error('❌ DeepCopy API Error:', apiError)
      return NextResponse.json(
        { error: 'Failed to submit job to DeepCopy API', details: apiError instanceof Error ? apiError.message : String(apiError) },
        { status: 500 }
      )
    }

    // Create job in database with the DeepCopy job ID as the primary ID
    const brandInfoSafe = typeof brand_info === 'string' ? brand_info : ''
    const job = await createJob({
      user_id: user.id,
      title,
      brand_info: brandInfoSafe,
      sales_page_url,
      template_id: undefined, // No template selection at creation
      advertorial_type: 'advertorial', // Default type for database constraint, will be determined later from swipe results
      target_approach,
      avatars: avatars || [],
      execution_id: deepCopyJobId,
      custom_id: deepCopyJobId, // Use DeepCopy job ID as the primary key
      screenshot: product_image || undefined // Store screenshot from avatar extraction (product_image)
    })

    // Update job status to processing
    await updateJobStatus(job.id, 'processing')

    // Screenshot will be extracted from API response (product_image) when results are stored
    // No need to generate screenshot using Playwright anymore

    // Immediately check the job status to get initial progress
    try {
      const statusResponse = await deepCopyClient.getJobStatus(deepCopyJobId)

      if (statusResponse.status === 'SUCCEEDED') {
        // Job completed immediately - get results and store them
        const result = await deepCopyClient.getJobResult(deepCopyJobId)
        await storeJobResults(job.id, result, deepCopyJobId)
        await updateJobStatus(job.id, 'completed', 100)

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
    }


    return createSuccessResponse(job)
  } catch (error) {
    return handleApiError(error)
  }
}

// Store job results in database
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

    // Screenshot is already stored from avatar extraction (product_image) when job is created
    // No need to extract from job results since product_image comes from avatar API, not job results

  } catch (error) {
    throw error
  }
}

