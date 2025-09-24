import { NextRequest, NextResponse } from 'next/server'
import { getJobsByUserId, createJob, updateJobStatus } from '@/lib/db/queries'
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
    console.error('Jobs fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, brand_info, sales_page_url, template_id } = await request.json()

    if (!title || !brand_info) {
      return NextResponse.json(
        { error: 'Title and brand info are required' },
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
    
    // Submit job to DeepCopy API first to get the job ID
    let deepCopyJobId: string
    try {
      console.log('Submitting job to DeepCopy API:', {
        sales_page_url: sales_page_url || '',
        project_name: title,
        swipe_file_id: 'L00005',
        advertorial_type: 'Listicle'
      })

      const deepCopyResponse = await deepCopyClient.submitJob({
        sales_page_url: sales_page_url || '',
        project_name: title,
        swipe_file_id: 'L00005', // Hardcoded as requested
        advertorial_type: 'Listicle' // Default type
      })

      console.log('DeepCopy API response:', deepCopyResponse)
      deepCopyJobId = deepCopyResponse.jobId

    } catch (apiError) {
      console.error('DeepCopy API error:', apiError)
      console.error('API error details:', {
        message: apiError instanceof Error ? apiError.message : 'Unknown error',
        stack: apiError instanceof Error ? apiError.stack : undefined
      })
      return NextResponse.json(
        { error: 'Failed to submit job to DeepCopy API' },
        { status: 500 }
      )
    }

    // Create job in database with the DeepCopy job ID as the primary ID
    const job = await createJob({
      user_id: user.id,
      title,
      brand_info,
      sales_page_url,
      template_id,
      execution_id: deepCopyJobId,
      custom_id: deepCopyJobId // Use DeepCopy job ID as the primary key
    })

    // Update job status to processing
    await updateJobStatus(job.id, 'processing')

    console.log(`Job ${job.id} created with DeepCopy ID: ${deepCopyJobId} - background polling will handle status updates`)

    return NextResponse.json(job)
  } catch (error) {
    console.error('Job creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    )
  }
}

// Background polling is now handled by the background service
