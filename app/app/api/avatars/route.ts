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
    // All jobs are treated the same - no special filtering needed
    let sql = `
      SELECT 
        j.id as job_id,
        j.title as job_title,
        j.created_at as job_created_at,
        j.avatars,
        j.execution_id
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
    
    for (const job of result.rows) {
      const avatars = typeof job.avatars === 'string' 
        ? JSON.parse(job.avatars) 
        : job.avatars || []
      
      // If job doesn't have execution_id, it's a pending job (avatars extracted but not submitted to DeepCopy)
      // Return avatars directly without looking for research jobs
      if (!job.execution_id) {
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
        // For jobs with execution_id, get research jobs (child jobs) for each avatar
        const avatarJobs = await query(
          `SELECT id, avatar_persona_name, status, execution_id, progress, created_at, updated_at
           FROM jobs 
           WHERE parent_job_id = $1 
           AND avatar_persona_name IS NOT NULL`,
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
    }

    return createSuccessResponse({ avatars: allAvatars })
  } catch (error) {
    return handleApiError(error)
  }
}

