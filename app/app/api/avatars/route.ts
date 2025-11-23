import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

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

    // Get jobId from query params if provided
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')

    // Build query with optional jobId filter
    let sql = `
      SELECT 
        j.id as job_id,
        j.title as job_title,
        j.created_at as job_created_at,
        j.avatars
      FROM jobs j
      WHERE j.user_id = $1 
        AND j.avatars IS NOT NULL 
        AND jsonb_array_length(j.avatars) > 0
    `
    const params: any[] = [user.id]

    if (jobId) {
      sql += ` AND j.id = $2`
      params.push(jobId)
    }

    sql += ` ORDER BY j.created_at DESC`

    const result = await query(sql, params)

    // Flatten avatars and add job context
    const allAvatars: any[] = []
    
    result.rows.forEach((job: any) => {
      const avatars = typeof job.avatars === 'string' 
        ? JSON.parse(job.avatars) 
        : job.avatars || []
      
      avatars.forEach((avatar: any, index: number) => {
        allAvatars.push({
          ...avatar,
          job_id: job.job_id,
          job_title: job.job_title,
          job_created_at: job.job_created_at,
          avatar_index: index // Store original index for reference
        })
      })
    })

    return NextResponse.json({ avatars: allAvatars })
  } catch (error) {
    console.error('Failed to fetch avatars:', error)
    return NextResponse.json(
      { error: 'Failed to fetch avatars', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

