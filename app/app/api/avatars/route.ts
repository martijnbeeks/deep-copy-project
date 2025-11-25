import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }
    const user = authResult.user

    // Get jobId from query params if provided
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')

    // Build query with optional jobId filter - only get parent jobs (not avatar jobs)
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
        AND (j.is_avatar_job IS NULL OR j.is_avatar_job = FALSE)
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
    
    for (const job of result.rows) {
      const avatars = typeof job.avatars === 'string' 
        ? JSON.parse(job.avatars) 
        : job.avatars || []
      
      // Get avatar jobs for this parent job
      const avatarJobs = await query(
        `SELECT id, avatar_persona_name, status, execution_id, progress, created_at, updated_at
         FROM jobs 
         WHERE parent_job_id = $1 AND is_avatar_job = TRUE`,
        [job.job_id]
      )
      
      avatars.forEach((avatar: any, index: number) => {
        const avatarJob = avatarJobs.rows.find(
          (aj: any) => aj.avatar_persona_name === avatar.persona_name
        )
        
        allAvatars.push({
          ...avatar,
          job_id: avatarJob?.id || job.job_id, // Use avatar job ID if exists, otherwise parent job ID
          parent_job_id: job.job_id,
          avatar_job_id: avatarJob?.id || null,
          job_title: job.job_title,
          job_created_at: job.job_created_at,
          avatar_index: index,
          is_researched: avatarJob ? true : (avatar.is_researched || false),
          avatar_job_status: avatarJob?.status || null,
          avatar_job_progress: avatarJob?.progress || null
        })
      })
    }

    return createSuccessResponse({ avatars: allAvatars })
  } catch (error) {
    return handleApiError(error)
  }
}

