import { NextRequest } from 'next/server'
import { createJob, updateJobStatus } from '@/lib/db/queries'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { logger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const {
      sales_page_url,
      avatars,
      product_image,
      title
    } = await request.json()

    if (!sales_page_url) {
      return createValidationErrorResponse('Sales page URL is required')
    }

    if (!avatars || !Array.isArray(avatars) || avatars.length === 0) {
      return createValidationErrorResponse('Avatars array is required and must not be empty')
    }

    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }
    const user = authResult.user

    // Generate title if not provided
    const jobTitle = title || new URL(sales_page_url).hostname

    // Create regular marketing angle job (no is_avatar_job flag)
    // Status is 'pending' until user confirms and submits to DeepCopy
    const job = await createJob({
      user_id: user.id,
      title: jobTitle,
      brand_info: '', // Will be filled when user confirms
      sales_page_url,
      template_id: undefined,
      advertorial_type: 'advertorial', // Default type for database constraint
      target_approach: 'explore', // Default since avatars were extracted
      avatars: avatars || [],
      execution_id: undefined, // Will be set when submitted to DeepCopy
      custom_id: undefined, // No custom ID needed (will use UUID)
      parent_job_id: undefined,
      avatar_persona_name: undefined,
      is_avatar_job: false, // Treat as regular marketing angle job
      screenshot: product_image || undefined
    })

    // Set status to pending - waiting for user to confirm and submit to DeepCopy
    await updateJobStatus(job.id, 'pending', 0)

    logger.log(`✅ Avatar extraction job saved: ${job.id} for user ${user.id}`)

    return createSuccessResponse({ job })
  } catch (error) {
    return handleApiError(error)
  }
}

