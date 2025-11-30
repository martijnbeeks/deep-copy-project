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

    // Create job with is_avatar_job = true
    const job = await createJob({
      user_id: user.id,
      title: jobTitle,
      brand_info: '', // Avatar extraction jobs don't have brand info
      sales_page_url,
      template_id: undefined,
      advertorial_type: 'advertorial', // Default type for database constraint
      target_approach: 'explore', // Default since avatars were extracted
      avatars: avatars || [],
      execution_id: undefined, // No DeepCopy execution ID for avatar extraction jobs
      custom_id: undefined, // No custom ID needed
      parent_job_id: undefined,
      avatar_persona_name: undefined,
      is_avatar_job: true,
      screenshot: product_image || undefined
    })

    // Set status to completed since avatars are already extracted
    await updateJobStatus(job.id, 'completed', 100)

    logger.log(`✅ Avatar extraction job saved: ${job.id} for user ${user.id}`)

    return createSuccessResponse({ job })
  } catch (error) {
    return handleApiError(error)
  }
}

