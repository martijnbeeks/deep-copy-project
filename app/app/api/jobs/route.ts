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
      template_id, 
      advertorial_type, 
      target_approach,
      customer_avatars,
      // Deprecated fields for backward compatibility
      persona, 
      age_range, 
      gender 
    } = await request.json()

    if (!title || !advertorial_type) {
      return NextResponse.json(
        { error: 'Title and advertorial type are required' },
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
    
    // Use provided customer avatars (extracted from frontend dialog)
    const finalCustomerAvatars = customer_avatars || []

    // Use the template_id directly as swipe_file_id for DeepCopy API
    // Ensure we have valid template IDs: A00001-A00004 for advertorial, L00001-L00004 for listicle
    const swipeFileId = template_id || (advertorial_type === 'listicle' ? 'L00001' : 'A00001')
    
    console.log(`🔍 Template Selection Debug:`)
    console.log(`  - Advertorial Type: ${advertorial_type}`)
    console.log(`  - Selected Template ID: ${template_id}`)
    console.log(`  - Swipe File ID for DeepCopy: ${swipeFileId}`)
    
    if (!swipeFileId) {
      return NextResponse.json(
        { error: `No template ID provided for advertorial type: ${advertorial_type}` },
        { status: 400 }
      )
    }

    // Submit job to DeepCopy API first to get the job ID
    let deepCopyJobId: string
    try {
      const jobPayload: any = {
        sales_page_url: sales_page_url || '',
        project_name: title,
        swipe_file_id: swipeFileId, 
        advertorial_type
      }

      // Use new customer_avatars format if available, otherwise fall back to deprecated fields
      if (finalCustomerAvatars.length > 0) {
        jobPayload.customer_avatars = finalCustomerAvatars
      } else if (persona || age_range || gender) {
        // Fallback to deprecated fields for backward compatibility
        jobPayload.persona = persona
        jobPayload.age_range = age_range
        jobPayload.gender = gender
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
      template_id,
      advertorial_type,
      target_approach,
      customer_avatars: finalCustomerAvatars,
      // Deprecated fields for backward compatibility
      persona,
      age_range,
      gender,
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

