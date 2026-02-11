import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'

export const maxDuration = 60 // Increase timeout to 60 seconds

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    const { id: jobId } = params
    const { searchParams } = new URL(request.url)
    const angleIndex = searchParams.get('angleIndex')
    const includeHtml = searchParams.get('includeHtml') === 'true' // Only include HTML if explicitly requested

    if (!jobId) {
      return createValidationErrorResponse('Job ID is required')
    }

    // Verify the user owns the job
    const jobResult = await query(
      'SELECT user_id FROM jobs WHERE id = $1',
      [jobId]
    )

    if (jobResult.rows.length === 0 || jobResult.rows[0].user_id !== authResult.user.id) {
      return createValidationErrorResponse('Unauthorized', 403)
    }

    // Get injected templates for this job
    // Only select HTML if explicitly requested to reduce payload size and improve performance
    let templates
    if (angleIndex && angleIndex !== '') {
      const angleIndexNum = parseInt(angleIndex)
      if (includeHtml) {
        templates = await query(
          'SELECT * FROM injected_templates WHERE job_id = $1 AND angle_index = $2 ORDER BY created_at DESC',
          [jobId, angleIndexNum + 1]
        )
      } else {
        // Exclude html_content to reduce payload size (can be 100KB+ per template)
        templates = await query(
          `SELECT id, job_id, template_id, angle_index, angle_name, config_data, created_at 
           FROM injected_templates 
           WHERE job_id = $1 AND angle_index = $2 
           ORDER BY created_at DESC`,
          [jobId, angleIndexNum + 1]
        )
      }
    } else {
      if (includeHtml) {
        templates = await query(
          'SELECT * FROM injected_templates WHERE job_id = $1 ORDER BY angle_index, created_at DESC',
          [jobId]
        )
      } else {
        // Exclude html_content to reduce payload size
        templates = await query(
          `SELECT id, job_id, template_id, angle_index, angle_name, config_data, created_at 
           FROM injected_templates 
           WHERE job_id = $1 
           ORDER BY angle_index, created_at DESC`,
          [jobId]
        )
      }
    }

    return createSuccessResponse({
      templates: templates.rows
    })
  } catch (error) {
    return handleApiError(error)
  }
}
