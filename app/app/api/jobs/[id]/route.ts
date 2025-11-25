import { NextRequest } from 'next/server'
import { getJobById, deleteJobById, updateJob } from '@/lib/db/queries'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    const job = await getJobById(jobId, authResult.user.id)
    if (!job) {
      return createValidationErrorResponse('Job not found')
    }

    const response = createSuccessResponse(job)
    response.headers.set('X-Timestamp', Date.now().toString())
    return response
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    // First check if the job exists and belongs to the user
    const existingJob = await getJobById(jobId, authResult.user.id)
    if (!existingJob) {
      return createValidationErrorResponse('Job not found')
    }

    const body = await request.json()
    const { title, brand_info, sales_page_url } = body

    // Build updates object with only provided fields
    const updates: { title?: string; brand_info?: string; sales_page_url?: string } = {}
    if (title !== undefined) updates.title = title
    if (brand_info !== undefined) updates.brand_info = brand_info
    if (sales_page_url !== undefined) updates.sales_page_url = sales_page_url

    if (Object.keys(updates).length === 0) {
      return createValidationErrorResponse('No valid fields to update')
    }

    // Update the job
    const updatedJob = await updateJob(jobId, authResult.user.id, updates)
    
    if (!updatedJob) {
      throw new Error('Failed to update job')
    }

    return createSuccessResponse({ job: updatedJob })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    // First check if the job exists and belongs to the user
    const job = await getJobById(jobId, authResult.user.id)
    if (!job) {
      return createValidationErrorResponse('Job not found')
    }

    // Delete the job
    await deleteJobById(jobId, authResult.user.id)
    
    return createSuccessResponse({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
