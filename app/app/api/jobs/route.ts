import { NextRequest, NextResponse } from 'next/server'
import { getJobsByUserId, createJob, updateJobStatus, createResult } from '@/lib/db/queries'
import { deepCopyClient } from '@/lib/api/deepcopy-client'

export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined

    const jobs = await getJobsByUserId(user.id, { status, search })

    return NextResponse.json({ jobs })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      title, 
      brand_info, 
      sales_page_url, 
      target_approach,
      avatars
    } = await request.json()

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    if (!target_approach) {
      return NextResponse.json(
        { error: 'Target approach is required' },
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
    let deepCopyJobId: string
    try {
      const jobPayload: any = {
        sales_page_url: sales_page_url || '',
        project_name: title
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

    // Create job in database with the DeepCopy job ID as the primary ID
    const brandInfoSafe = typeof brand_info === 'string' ? brand_info : ''
    const job = await createJob({
      user_id: user.id,
      title,
      brand_info: brandInfoSafe,
      sales_page_url,
      template_id: null, // No template selection at creation
      advertorial_type: 'advertorial', // Default type for database constraint, will be determined later from swipe results
      target_approach,
      avatars: avatars || [],
      execution_id: deepCopyJobId,
      custom_id: deepCopyJobId // Use DeepCopy job ID as the primary key
    })

    // Update job status to processing
    await updateJobStatus(job.id, 'processing')

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


    return NextResponse.json(job)
  } catch (error) {
    console.error('❌ Job Creation Error:', error)
    return NextResponse.json(
      { error: 'Failed to create job', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
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
    
    
  } catch (error) {
    throw error
  }
}

