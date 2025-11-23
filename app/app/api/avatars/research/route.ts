import { NextRequest, NextResponse } from 'next/server'
import { getJobById, updateJobStatus, createResult } from '@/lib/db/queries'
import { deepCopyClient } from '@/lib/api/deepcopy-client'
import { query } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  try {
    const { jobId, personaName } = await request.json()

    if (!jobId || !personaName) {
      return NextResponse.json(
        { error: 'Job ID and persona name are required' },
        { status: 400 }
      )
    }

    const authHeader = request.headers.get('authorization')
    const userEmail = authHeader?.replace('Bearer ', '') || 'demo@example.com'
    
    const { getUserByEmail } = await import('@/lib/db/queries')
    const user = await getUserByEmail(userEmail)
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get the parent job
    const parentJob = await getJobById(jobId, user.id)
    if (!parentJob) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Get avatars from parent job
    const avatars = parentJob.avatars || []
    const avatarIndex = avatars.findIndex((a: any) => a.persona_name === personaName)
    
    if (avatarIndex === -1) {
      return NextResponse.json(
        { error: 'Avatar not found in job' },
        { status: 404 }
      )
    }

    // Mark the selected avatar as researched
    const updatedAvatars = avatars.map((avatar: any, index: number) => ({
      ...avatar,
      is_researched: index === avatarIndex ? true : (avatar.is_researched || false)
    }))

    // Get selected avatars (where is_researched === true) for DeepCopy API
    const selectedAvatars = updatedAvatars.filter((a: any) => a.is_researched === true)

    // Check if parent job already has an execution_id (already submitted to DeepCopy)
    if (parentJob.execution_id) {
      // Job already has results - just update avatars and return parent job
      await query(
        `UPDATE jobs SET avatars = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(updatedAvatars), jobId]
      )

      // Get updated job
      const updatedJob = await getJobById(jobId, user.id)

      return NextResponse.json({ 
        job: updatedJob,
        message: 'Avatar marked as researched'
      })
    }

    // Job hasn't been submitted yet - submit to DeepCopy with selected avatar
    let deepCopyJobId: string
    try {
      const jobPayload: any = {
        sales_page_url: parentJob.sales_page_url || '',
        project_name: parentJob.title
      }

      if (selectedAvatars.length > 0) {
        jobPayload.customer_avatars = selectedAvatars
      }

      const deepCopyResponse = await deepCopyClient.submitJob(jobPayload)
      deepCopyJobId = deepCopyResponse.jobId
    } catch (apiError) {
      console.error('❌ DeepCopy API Error:', apiError)
      return NextResponse.json(
        { error: 'Failed to submit job to DeepCopy API', details: apiError instanceof Error ? apiError.message : String(apiError) },
        { status: 500 }
      )
    }

    // Update parent job with avatars, execution_id, and status
    await query(
      `UPDATE jobs SET avatars = $1, execution_id = $2, status = 'processing', updated_at = NOW() WHERE id = $3`,
      [JSON.stringify(updatedAvatars), deepCopyJobId, jobId]
    )

    // Check initial status
    try {
      const statusResponse = await deepCopyClient.getJobStatus(deepCopyJobId)
      
      if (statusResponse.status === 'SUCCEEDED') {
        const result = await deepCopyClient.getJobResult(deepCopyJobId)
        await createResult(jobId, '', {
          deepcopy_job_id: deepCopyJobId,
          full_result: result,
          project_name: result.project_name,
          timestamp_iso: result.timestamp_iso,
          job_id: result.job_id,
          generated_at: new Date().toISOString()
        })
        await updateJobStatus(jobId, 'completed', 100)
      } else if (statusResponse.status === 'FAILED') {
        await updateJobStatus(jobId, 'failed')
      } else if (['RUNNING', 'SUBMITTED', 'PENDING'].includes(statusResponse.status)) {
        const progress = statusResponse.status === 'SUBMITTED' ? 25 : 
                       statusResponse.status === 'RUNNING' ? 50 : 30
        await updateJobStatus(jobId, 'processing', progress)
      }
    } catch (statusError) {
      // Continue even if status check fails
    }

    // Get updated job
    const updatedJob = await getJobById(jobId, user.id)

    return NextResponse.json({ 
      job: updatedJob,
      message: 'Research started successfully'
    })
  } catch (error) {
    console.error('❌ Avatar Research Error:', error)
    return NextResponse.json(
      { error: 'Failed to start research', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

