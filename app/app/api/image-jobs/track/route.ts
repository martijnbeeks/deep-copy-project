import { NextRequest, NextResponse } from 'next/server'
import { trackImageJob, startServerImagePolling } from '@/lib/services/server-image-polling'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { external_job_id, injected_template_id, user_id, prompts } = body

    if (!external_job_id || !injected_template_id || !user_id || !prompts) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Start the server polling if not already running
    startServerImagePolling()

    // Track the job in the database
    const localJobId = await trackImageJob({
      external_job_id,
      injected_template_id,
      user_id,
      prompts
    })

    return NextResponse.json({ 
      success: true, 
      localJobId,
      message: 'Job tracking started' 
    })

  } catch (error) {
    console.error('Error tracking image job:', error)
    return NextResponse.json(
      { error: 'Failed to track job' },
      { status: 500 }
    )
  }
}
