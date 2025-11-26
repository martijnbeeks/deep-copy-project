import { NextRequest } from 'next/server'
import { getJobById, deleteJobById, updateJob } from '@/lib/db/queries'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const marketingAngleId = params.id
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    const marketingAngle = await getJobById(marketingAngleId, authResult.user.id)
    if (!marketingAngle) {
      return createValidationErrorResponse('Marketing angle not found', 404)
    }

    const response = createSuccessResponse(marketingAngle)
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
    const marketingAngleId = params.id
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    // First check if the marketing angle exists and belongs to the user
    const existingMarketingAngle = await getJobById(marketingAngleId, authResult.user.id)
    if (!existingMarketingAngle) {
      return createValidationErrorResponse('Marketing angle not found', 404)
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

    // Update the marketing angle
    const updatedMarketingAngle = await updateJob(marketingAngleId, authResult.user.id, updates)
    
    if (!updatedMarketingAngle) {
      throw new Error('Failed to update marketing angle')
    }

    return createSuccessResponse({ marketingAngle: updatedMarketingAngle })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const marketingAngleId = params.id
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    // First check if the marketing angle exists and belongs to the user
    const marketingAngle = await getJobById(marketingAngleId, authResult.user.id)
    if (!marketingAngle) {
      return createValidationErrorResponse('Marketing angle not found', 404)
    }

    // Delete the marketing angle
    await deleteJobById(marketingAngleId, authResult.user.id)
    
    return createSuccessResponse({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
