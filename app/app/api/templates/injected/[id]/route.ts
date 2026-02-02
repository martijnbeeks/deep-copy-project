import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Get the injected template by ID
    const result = await query(
      'SELECT * FROM injected_templates WHERE id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    const template = result.rows[0]

    // Get swipe file name if template_id exists
    let swipe_file_name = null
    if (template.template_id) {
      try {
        const templateIdParam = String(template.template_id).trim()
        const nameResult = await query(
          'SELECT name FROM injectable_templates WHERE id::text = $1::text',
          [templateIdParam]
        )
        
        if (nameResult.rows.length > 0) {
          swipe_file_name = nameResult.rows[0].name
        }
      } catch (error) {
        console.error(`Error fetching swipe_file_name:`, error)
      }
    }

    return NextResponse.json({
      ...template,
      swipe_file_name
    })

  } catch (error) {
    console.error('Error fetching injected template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    const { id } = params

    if (!id) {
      return createValidationErrorResponse('Template ID is required')
    }

    // Check if template exists and get job_id to verify ownership
    const templateResult = await query(
      'SELECT job_id FROM injected_templates WHERE id = $1',
      [id]
    )

    if (templateResult.rows.length === 0) {
      return createValidationErrorResponse('Template not found', 404)
    }

    const jobId = templateResult.rows[0].job_id

    // Verify the user owns the job
    const jobResult = await query(
      'SELECT user_id FROM jobs WHERE id = $1',
      [jobId]
    )

    if (jobResult.rows.length === 0 || jobResult.rows[0].user_id !== authResult.user.id) {
      return createValidationErrorResponse('Unauthorized', 403)
    }

    // Delete the template
    const deleteResult = await query(
      'DELETE FROM injected_templates WHERE id = $1',
      [id]
    )

    if (deleteResult.rowCount === 0) {
      return createValidationErrorResponse('Template not found', 404)
    }

    return createSuccessResponse({ 
      message: 'Template deleted successfully',
      id 
    })

  } catch (error) {
    return handleApiError(error)
  }
}
