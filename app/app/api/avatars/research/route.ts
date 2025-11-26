import { NextRequest, NextResponse } from 'next/server'
import { getJobById, updateJobStatus, createResult, createJob } from '@/lib/db/queries'
import { deepCopyClient } from '@/lib/clients/deepcopy-client'
import { query } from '@/lib/db/connection'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createValidationErrorResponse, createSuccessResponse } from '@/lib/middleware/error-handler'
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

    // Check if avatar job already exists for this persona
    const existingAvatarJob = await query(
      `SELECT * FROM jobs 
       WHERE parent_job_id = $1 
       AND avatar_persona_name = $2 
       AND user_id = $3
       LIMIT 1`,
      [jobId, personaName, user.id]
    )

    if (existingAvatarJob.rows.length > 0) {
      // Avatar job already exists, return it
      const avatarJob = existingAvatarJob.rows[0]

      // Update parent job's avatar to mark as researched
      const updatedAvatars = avatars.map((avatar: any) => ({
        ...avatar,
        is_researched: avatar.persona_name === personaName ? true : avatar.is_researched,
        avatar_job_id: avatar.persona_name === personaName ? avatarJob.id : avatar.avatar_job_id
      }))

      await query(
        `UPDATE jobs SET avatars = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(updatedAvatars), jobId]
      )

      return createSuccessResponse({
        job: avatarJob,
        message: 'Avatar job already exists'
      })
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

    // Create NEW job for this avatar
    const avatarJob = await createJob({
      user_id: user.id,
      title: `${parentJob.title} - ${personaName}`,
      brand_info: parentJob.brand_info,
      sales_page_url: parentJob.sales_page_url,
      template_id: undefined,
      advertorial_type: 'advertorial',
      target_approach: parentJob.target_approach,
      avatars: [selectedAvatar], // Only this avatar
      execution_id: deepCopyJobId,
      custom_id: deepCopyJobId,
      parent_job_id: jobId,
      avatar_persona_name: personaName,
      is_avatar_job: true
    })

    // Update parent job's avatar to mark as researched and link to avatar job
    const updatedAvatars = avatars.map((avatar: any) => ({
      ...avatar,
      is_researched: avatar.persona_name === personaName ? true : avatar.is_researched,
      avatar_job_id: avatar.persona_name === personaName ? avatarJob.id : avatar.avatar_job_id
    }))

    await query(
      `UPDATE jobs SET avatars = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedAvatars), jobId]
    )

    // Update avatar job status to processing
    await updateJobStatus(avatarJob.id, 'processing', 0)

    // Check initial status
    try {
      const statusResponse = await deepCopyClient.getMarketingAngleStatus(deepCopyJobId)

      if (statusResponse.status === 'SUCCEEDED') {
        const result = await deepCopyClient.getMarketingAngleResult(deepCopyJobId)
        await createResult(avatarJob.id, '', {
          deepcopy_job_id: deepCopyJobId,
          full_result: result,
          project_name: result.project_name,
          timestamp_iso: result.timestamp_iso,
          job_id: result.job_id,
          generated_at: new Date().toISOString()
        })
        await updateJobStatus(avatarJob.id, 'completed', 100)
      } else if (statusResponse.status === 'FAILED') {
        await updateJobStatus(avatarJob.id, 'failed')
      } else if (['RUNNING', 'SUBMITTED', 'PENDING'].includes(statusResponse.status)) {
        const progress = statusResponse.status === 'SUBMITTED' ? 25 :
          statusResponse.status === 'RUNNING' ? 50 : 30
        await updateJobStatus(avatarJob.id, 'processing', progress)
      }
    } catch (statusError) {
      // Continue even if status check fails
      logger.warn('Status check failed:', statusError)
    }

    return createSuccessResponse({
      job: avatarJob,
      message: 'Avatar research job created successfully'
    })
  } catch (error) {
    return handleApiError(error)
  }
}

