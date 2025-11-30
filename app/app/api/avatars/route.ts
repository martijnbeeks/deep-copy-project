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

    // Build query with optional jobId filter
    // If jobId is provided, include avatar jobs; otherwise exclude them
    let sql = `
      SELECT 
        j.id as job_id,
        j.title as job_title,
        j.created_at as job_created_at,
        j.avatars,
        j.is_avatar_job
      FROM jobs j
      WHERE j.user_id = $1 
        AND j.avatars IS NOT NULL 
        AND jsonb_array_length(j.avatars) > 0
    `
    const params: any[] = [user.id]

    if (jobId) {
      // When specific jobId is provided, include avatar jobs
      sql += ` AND j.id = $2`
      params.push(jobId)
    } else {
      // When listing all avatars, exclude avatar jobs (they're accessed via their own route)
      sql += ` AND (j.is_avatar_job IS NULL OR j.is_avatar_job = FALSE)`
    }

    sql += ` ORDER BY j.created_at DESC`

    const result = await query(sql, params)

    // Flatten avatars and add job context
    const allAvatars: any[] = []
    
    for (const job of result.rows) {
      const avatars = typeof job.avatars === 'string' 
        ? JSON.parse(job.avatars) 
        : job.avatars || []
      
      // If this is an avatar extraction job (is_avatar_job = true), return avatars directly
      if (job.is_avatar_job) {
        avatars.forEach((avatar: any, index: number) => {
          allAvatars.push({
            ...avatar,
            job_id: job.job_id,
            parent_job_id: null,
            avatar_job_id: null,
            job_title: job.job_title,
            job_created_at: job.job_created_at,
            avatar_index: index,
            is_researched: avatar.is_researched || false,
            avatar_job_status: null,
            avatar_job_progress: null
          })
        })
      } else {
        // For regular jobs, get research jobs (avatar jobs) for this parent job
        // For avatar extraction jobs, get regular research jobs (not is_avatar_job)
        const isAvatarExtractionJob = job.is_avatar_job && !job.parent_job_id
        const avatarJobsQuery = isAvatarExtractionJob
          ? `SELECT id, avatar_persona_name, status, execution_id, progress, created_at, updated_at
             FROM jobs 
             WHERE parent_job_id = $1 
             AND (is_avatar_job IS NULL OR is_avatar_job = FALSE)
             AND avatar_persona_name IS NOT NULL`
          : `SELECT id, avatar_persona_name, status, execution_id, progress, created_at, updated_at
             FROM jobs 
             WHERE parent_job_id = $1 AND is_avatar_job = TRUE`
        
        const avatarJobs = await query(avatarJobsQuery, [job.job_id])
        
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
    }

    return createSuccessResponse({ avatars: allAvatars })
  } catch (error) {
    return handleApiError(error)
  }
}

