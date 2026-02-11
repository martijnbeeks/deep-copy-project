import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { getDeepCopyAccessToken } from '@/lib/auth/deepcopy-auth'
import { handleApiError, createValidationErrorResponse, createSuccessResponse } from '@/lib/middleware/error-handler'
import { checkJobCreationLimit } from '@/lib/services/billing'
import { JOB_CREDITS_BY_TYPE } from '@/lib/constants/job-credits'

// This endpoint receives prompts and submits a job to the backend API
// The backend returns 202 with jobId, and the client polls for results
const BACKEND_API_URL = 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    const user = authResult.user
    const body = await request.json()
    const { templateId, type, prompts, productImageUrl, allowOverage } = body

    // Validation
    if (!templateId) {
      return createValidationErrorResponse('templateId is required')
    }

    if (!type) {
      return createValidationErrorResponse('type is required')
    }

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return createValidationErrorResponse('prompts array is required and must not be empty')
    }

    // Check job creation limits using job credits system
    const totalCreditsRequired = prompts.length * JOB_CREDITS_BY_TYPE.templates_images
    const jobLimitCheck = await checkJobCreationLimit(user.id, 'templates_images', totalCreditsRequired)
    
    if (!jobLimitCheck.canCreate && !allowOverage) {
      if (jobLimitCheck.overageConfirmationRequired) {
        return NextResponse.json(
          {
            error: 'Overage confirmation required',
            code: 'JOB_CREDITS_OVERAGE_CONFIRMATION_REQUIRED',
            message:
              jobLimitCheck.reason ||
              `You need ${totalCreditsRequired} job credits but only have ${jobLimitCheck.remaining} available.`,
            remaining: jobLimitCheck.remaining ?? 0,
            required: jobLimitCheck.required ?? totalCreditsRequired,
            overageCredits: jobLimitCheck.overageCredits ?? 0,
            overageCostPerCredit: jobLimitCheck.overageCostPerCredit,
            overageCostTotal: jobLimitCheck.overageCostTotal,
            currency: 'EUR',
          },
          { status: 402 }
        )
      }

      return NextResponse.json(
        {
          error: 'Insufficient job credits',
          message:
            jobLimitCheck.reason ||
            `You need ${totalCreditsRequired} job credits but only have ${jobLimitCheck.remaining} available. Each template image costs 1 job credit.`,
          currentUsage: jobLimitCheck.remaining,
          limit: 'unlimited',
          required: totalCreditsRequired,
        },
        { status: 429 }
      )
    }

    // Call backend API to submit image generation job
    // The backend accepts:
    // {
    //   templateId: string,
    //   type: string,
    //   prompts: Array<{ role: string, index?: number, prompt: string }>,
    //   productImageUrl?: string (optional - URL of uploaded product image)
    // }
    // And returns 202 Accepted with:
    // {
    //   jobId: string,
    //   status: "SUBMITTED"
    // }

    // Get backend auth token
    const token = await getDeepCopyAccessToken()

    // Call backend API - it returns 202 with jobId
    const backendResponse = await fetch(`${BACKEND_API_URL}prelander-images/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        templateId,
        type,
        prompts,
        ...(productImageUrl && { productImageUrl })
      })
    })

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      let errorData: any
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText }
      }
      return NextResponse.json(
        { error: errorData.error || `Backend API error: ${backendResponse.status}` },
        { status: backendResponse.status }
      )
    }

    const backendData = await backendResponse.json()

    // Backend returns 202 with { jobId, status: "SUBMITTED" }
    // Return this to client so it can poll for results
    // Credits will be deducted when results are retrieved
    return createSuccessResponse({
      jobId: backendData.jobId,
      status: backendData.status || 'SUBMITTED'
    })
  } catch (error) {
    return handleApiError(error)
  }
}

