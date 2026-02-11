import { NextRequest, NextResponse } from 'next/server'
import { getJobById, deleteJobById, updateJob, updateJobStatus, createResult } from '@/lib/db/queries'
import { query } from '@/lib/db/connection'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { deepCopyClient } from '@/lib/clients/deepcopy-client'
import { checkJobCreationLimit } from '@/lib/services/billing'
import { logger } from '@/lib/utils/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const marketingAngleId = params.id
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    const marketingAngle = await getJobById(marketingAngleId, authResult.user.id)
    if (!marketingAngle) {
      return createValidationErrorResponse('Marketing angle not found', 404)
    }

    const response = createSuccessResponse(marketingAngle)
    response.headers.set('X-Timestamp', Date.now().toString())
    return response
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const marketingAngleId = params.id
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    // First check if the job exists and belongs to the user
    const existingJob = await getJobById(marketingAngleId, authResult.user.id)
    if (!existingJob) {
      return createValidationErrorResponse('Job not found', 404)
    }

    const body = await request.json()
    const { 
      title, 
      brand_info, 
      sales_page_url, 
      target_approach, 
      avatars, 
      product_image,
      allowOverage
    } = body

    // If job doesn't have execution_id, it means it hasn't been submitted to DeepCopy yet
    // This happens when avatars were extracted but user hasn't confirmed yet
    const needsDeepCopySubmission = !existingJob.execution_id

    if (needsDeepCopySubmission) {
      // Job was created from avatar extraction, now submitting to DeepCopy
      if (!title) {
        return createValidationErrorResponse('Title is required')
      }

      if (!target_approach) {
        return createValidationErrorResponse('Target approach is required')
      }

      // Get selected avatars (where is_researched === true) for DeepCopy API
      const selectedAvatars = avatars?.filter((a: any) => a.is_researched === true) || []

      if (selectedAvatars.length === 0) {
        // No avatars selected - just update the job without submitting to DeepCopy
        const brandInfoSafe = typeof brand_info === 'string' ? brand_info : (existingJob.brand_info || '')
        
        await query(
          `UPDATE jobs 
           SET title = $1, 
               brand_info = $2, 
               sales_page_url = $3, 
               target_approach = $4, 
               avatars = $5, 
               screenshot = $6,
               status = 'pending',
               updated_at = NOW()
           WHERE id = $7 AND user_id = $8`,
          [
            title,
            brandInfoSafe,
            sales_page_url || existingJob.sales_page_url,
            target_approach,
            JSON.stringify(avatars || existingJob.avatars || []),
            product_image || existingJob.screenshot || null,
            marketingAngleId,
            authResult.user.id
          ]
        )

        const updatedJob = await getJobById(marketingAngleId, authResult.user.id)
        return createSuccessResponse({ job: updatedJob })
      }

      // Check job credit limit (event-based) before submitting to DeepCopy
      const limitCheck = await checkJobCreationLimit(authResult.user.id, 'deep_research')
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

      // Submit to DeepCopy API
      let deepCopyJobId: string
      try {
        const marketingAnglePayload = {
          title: title,
          brand_info: brand_info || '',
          sales_page_url: sales_page_url || existingJob.sales_page_url || '',
          target_approach: target_approach,
          avatars: selectedAvatars.map((avatar: any) => ({
            persona_name: avatar.persona_name,
            is_researched: avatar.is_researched || true
          }))
        }

        const deepCopyResponse = await deepCopyClient.submitMarketingAngle(marketingAnglePayload)
        deepCopyJobId = deepCopyResponse.jobId
      } catch (apiError) {
        logger.error('❌ DeepCopy API Error:', apiError)
        return NextResponse.json(
          { error: 'Failed to submit marketing angle to DeepCopy API', details: apiError instanceof Error ? apiError.message : String(apiError) },
          { status: 500 }
        )
      }

      // Update the job with DeepCopy execution_id and set status to processing
      const brandInfoSafe = typeof brand_info === 'string' ? brand_info : (existingJob.brand_info || '')
      
      await query(
        `UPDATE jobs 
         SET title = $1, 
             brand_info = $2, 
             sales_page_url = $3, 
             target_approach = $4, 
             avatars = $5, 
             execution_id = $6,
             screenshot = $7,
             status = 'processing',
             updated_at = NOW()
         WHERE id = $8 AND user_id = $9`,
        [
          title,
          brandInfoSafe,
          sales_page_url || existingJob.sales_page_url,
          target_approach,
          JSON.stringify(avatars || existingJob.avatars || []),
          deepCopyJobId,
          product_image || existingJob.screenshot || null,
          marketingAngleId,
          authResult.user.id
        ]
      )

      // Update job status to processing
      await updateJobStatus(marketingAngleId, 'processing')

      // Check initial status
      try {
        const statusResponse = await deepCopyClient.getMarketingAngleStatus(deepCopyJobId)

        if (statusResponse.status === 'SUCCEEDED') {
          const result = await deepCopyClient.getMarketingAngleResult(deepCopyJobId)
          await createResult(marketingAngleId, '', {
            deepcopy_job_id: deepCopyJobId,
            full_result: result,
            project_name: result.project_name,
            timestamp_iso: result.timestamp_iso,
            job_id: result.job_id,
            generated_at: new Date().toISOString()
          })
          await updateJobStatus(marketingAngleId, 'completed', 100)
          try {
            const { recordJobCreditEvent } = await import('@/lib/services/billing')
            const { JOB_CREDITS_BY_TYPE } = await import('@/lib/constants/job-credits')
            await recordJobCreditEvent({ userId: authResult.user.id, jobId: marketingAngleId, jobType: 'pre_lander', credits: JOB_CREDITS_BY_TYPE.pre_lander })
          } catch (creditErr) {
            // don't fail the request
          }
        } else if (statusResponse.status === 'FAILED') {
          await updateJobStatus(marketingAngleId, 'failed')
        } else if (['RUNNING', 'SUBMITTED', 'PENDING'].includes(statusResponse.status)) {
          const progress = statusResponse.status === 'SUBMITTED' ? 25 :
            statusResponse.status === 'RUNNING' ? 50 : 30
          await updateJobStatus(marketingAngleId, 'processing', progress)
        }
      } catch (statusError) {
        // Continue even if status check fails
      }

      const updatedJob = await getJobById(marketingAngleId, authResult.user.id)
      return createSuccessResponse(updatedJob || {})
    } else {
      // Regular update (job already has execution_id, just updating fields)
      const { title, brand_info, sales_page_url } = body

      // Build updates object with only provided fields
      const updates: { title?: string; brand_info?: string; sales_page_url?: string } = {}
      if (title !== undefined) updates.title = title
      if (brand_info !== undefined) updates.brand_info = brand_info
      if (sales_page_url !== undefined) updates.sales_page_url = sales_page_url

      if (Object.keys(updates).length === 0) {
        return createValidationErrorResponse('No valid fields to update')
      }

      // Update the marketing angle
      const updatedMarketingAngle = await updateJob(marketingAngleId, authResult.user.id, updates)
      
      if (!updatedMarketingAngle) {
        throw new Error('Failed to update marketing angle')
      }

      return createSuccessResponse(updatedMarketingAngle)
    }
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const marketingAngleId = params.id
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    // First check if the marketing angle exists and belongs to the user
    const marketingAngle = await getJobById(marketingAngleId, authResult.user.id)
    if (!marketingAngle) {
      return createValidationErrorResponse('Marketing angle not found', 404)
    }

    // Delete the marketing angle
    await deleteJobById(marketingAngleId, authResult.user.id)
    
    return createSuccessResponse({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
