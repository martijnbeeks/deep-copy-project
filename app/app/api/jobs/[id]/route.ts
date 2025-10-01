import { NextRequest, NextResponse } from 'next/server'
import { getJobById, deleteJobById } from '@/lib/db/queries'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
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

    const job = await getJobById(jobId, user.id)
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(job)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch job' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
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

    // First check if the job exists and belongs to the user
    const job = await getJobById(jobId, user.id)
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Delete the job
    await deleteJobById(jobId, user.id)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete job' },
      { status: 500 }
    )
  }
}
