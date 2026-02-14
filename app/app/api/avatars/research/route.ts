import { NextRequest, NextResponse } from 'next/server'
import { getJobById, updateJobStatus, createResult, createJob } from '@/lib/db/queries'
import { deepCopyClient } from '@/lib/clients/deepcopy-client'
import { query } from '@/lib/db/connection'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createValidationErrorResponse, createSuccessResponse } from '@/lib/middleware/error-handler'
import { checkJobCreationLimit } from '@/lib/services/billing'
import { logger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const { jobId, personaName, allowOverage } = await request.json()

    if (!jobId || !personaName) {
      return createValidationErrorResponse('Job ID and persona name are required')
    }

    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }
    const user = authResult.user

    // Get the parent job
    const parentJob = await getJobById(jobId, user.id)
    if (!parentJob) {
      return createValidationErrorResponse('Job not found', 404)
    }

    // Get avatars from parent job
    const avatars = parentJob.avatars || []
    const selectedAvatar = avatars.find((a: any) => a.persona_name === personaName)

    if (!selectedAvatar) {
      return createValidationErrorResponse('Avatar not found in job', 404)
    }

    // Check if research job already exists for this persona
    const existingAvatarJob = await query(
      `SELECT * FROM jobs 
       WHERE parent_job_id = $1 
       AND avatar_persona_name = $2 
       AND user_id = $3
       LIMIT 1`,
      [jobId, personaName, user.id]
    )

    if (existingAvatarJob.rows.length > 0) {
      // Research job already exists, return it
      const researchJob = existingAvatarJob.rows[0]

      // Update parent job's avatar to mark as researched
      const updatedAvatars = avatars.map((avatar: any) => ({
        ...avatar,
        is_researched: avatar.persona_name === personaName ? true : avatar.is_researched,
        avatar_job_id: avatar.persona_name === personaName ? researchJob.id : avatar.avatar_job_id
      }))

      await query(
        `UPDATE jobs SET avatars = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(updatedAvatars), jobId]
      )

      return createSuccessResponse({
        job: researchJob,
        message: 'Research job already exists'
      })
    }

    // Check job credit limit (event-based) before creating research job
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

    // Submit NEW job to DeepCopy API with ONLY this avatar
    let deepCopyJobId: string
    try {
      const deepCopyResponse = await deepCopyClient.submitV2Research({
        project_name: `${parentJob.title} - ${personaName}`,
        sales_page_url: parentJob.sales_page_url || '',
        advertorial_type: parentJob.target_approach || 'aggressive',
      })
      deepCopyJobId = deepCopyResponse.jobId
    } catch (apiError) {
      logger.error('❌ DeepCopy API Error:', apiError)
      return handleApiError(apiError)
    }

    // Create NEW research job for this avatar
    // All research jobs are treated the same - no is_avatar_job distinction needed
    const researchJob = await createJob({
      user_id: user.id,
      title: `${parentJob.title} - ${personaName}`,
      brand_info: parentJob.brand_info || '',
      sales_page_url: parentJob.sales_page_url,
      template_id: undefined,
      advertorial_type: 'advertorial',
      target_approach: parentJob.target_approach || 'aggressive',
      avatars: [selectedAvatar], // Only this avatar
      execution_id: deepCopyJobId,
      custom_id: deepCopyJobId,
      parent_job_id: jobId,
      avatar_persona_name: personaName,
      is_avatar_job: false // All jobs are regular marketing angle jobs
    })

    // Update parent job's avatar to mark as researched and link to research job
    const updatedAvatars = avatars.map((avatar: any) => ({
      ...avatar,
      is_researched: avatar.persona_name === personaName ? true : avatar.is_researched,
      avatar_job_id: avatar.persona_name === personaName ? researchJob.id : avatar.avatar_job_id
    }))

    await query(
      `UPDATE jobs SET avatars = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedAvatars), jobId]
    )

    // Update research job status to processing
    await updateJobStatus(researchJob.id, 'processing', 0)

    // Check initial status
    try {
      const statusResponse = await deepCopyClient.getJobStatus(deepCopyJobId)

      if (statusResponse.status === 'SUCCEEDED') {
        const result = await deepCopyClient.getJobResult(deepCopyJobId)
        await createResult(researchJob.id, '', {
          deepcopy_job_id: deepCopyJobId,
          full_result: result,
          project_name: result.project_name,
          timestamp_iso: result.timestamp_iso,
          job_id: result.job_id,
          generated_at: new Date().toISOString()
        })
        await updateJobStatus(researchJob.id, 'completed', 100)
        try {
          const { recordJobCreditEvent } = await import('@/lib/services/billing')
          const { JOB_CREDITS_BY_TYPE } = await import('@/lib/constants/job-credits')
          await recordJobCreditEvent({ userId: user.id, jobId: researchJob.id, jobType: 'deep_research', credits: JOB_CREDITS_BY_TYPE.deep_research })
        } catch (creditErr) {
          logger.warn('Failed to record job credit event:', creditErr)
        }
      } else if (statusResponse.status === 'FAILED') {
        await updateJobStatus(researchJob.id, 'failed')
      } else if (['RUNNING', 'SUBMITTED', 'PENDING'].includes(statusResponse.status)) {
        const progress = statusResponse.status === 'SUBMITTED' ? 25 :
          statusResponse.status === 'RUNNING' ? 50 : 30
        await updateJobStatus(researchJob.id, 'processing', progress)
      }
    } catch (statusError) {
      // Continue even if status check fails
      logger.warn('Status check failed:', statusError)
    }

    return createSuccessResponse({
      job: researchJob,
      message: 'Research job created successfully'
    })
  } catch (error) {
    return handleApiError(error)
  }
}

