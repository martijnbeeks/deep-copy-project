import { NextRequest, NextResponse } from 'next/server'
import { getJobById, updateJobStatus, createResult, createJob } from '@/lib/db/queries'
import { deepCopyClient } from '@/lib/clients/deepcopy-client'
import { query } from '@/lib/db/connection'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createValidationErrorResponse, createSuccessResponse } from '@/lib/middleware/error-handler'
import { checkAndIncrementUsage } from '@/lib/middleware/usage-limits'
import { logger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const { jobId, personaName } = await request.json()

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

    // Check usage limits before creating new research job
    const usageCheck = await checkAndIncrementUsage(user, 'deep_research')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Usage limit exceeded',
          message: usageCheck.error || `You've reached your weekly limit of ${usageCheck.limit} Deep Research actions. Your limit resets automatically based on a rolling 7-day window.`,
          currentUsage: usageCheck.currentUsage,
          limit: usageCheck.limit
        },
        { status: 429 } // Too Many Requests
      )
    }

    // Submit NEW job to DeepCopy API with ONLY this avatar
    let deepCopyJobId: string
    try {
      const jobPayload: any = {
        sales_page_url: parentJob.sales_page_url || '',
        project_name: `${parentJob.title} - ${personaName}`,
        customer_avatars: [selectedAvatar] // Only the selected avatar
      }

      const deepCopyResponse = await deepCopyClient.submitMarketingAngle({
        title: jobPayload.project_name,
        brand_info: '',
        sales_page_url: jobPayload.sales_page_url,
        target_approach: 'aggressive',
        avatars: jobPayload.customer_avatars?.map((avatar: any) => ({
          persona_name: avatar.persona_name,
          is_researched: avatar.is_researched || true
        })) || []
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
      const statusResponse = await deepCopyClient.getMarketingAngleStatus(deepCopyJobId)

      if (statusResponse.status === 'SUCCEEDED') {
        const result = await deepCopyClient.getMarketingAngleResult(deepCopyJobId)
        await createResult(researchJob.id, '', {
          deepcopy_job_id: deepCopyJobId,
          full_result: result,
          project_name: result.project_name,
          timestamp_iso: result.timestamp_iso,
          job_id: result.job_id,
          generated_at: new Date().toISOString()
        })
        await updateJobStatus(researchJob.id, 'completed', 100)
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

