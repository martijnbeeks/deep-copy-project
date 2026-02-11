import { NextRequest, NextResponse } from 'next/server'
import { getDeepCopyAccessToken } from '@/lib/auth/deepcopy-auth'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createValidationErrorResponse, createSuccessResponse } from '@/lib/middleware/error-handler'

const BACKEND_API_URL = 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    const body = await request.json()
    const { html, deepResearch, angle, productName, avatar, productImage, language, targetAge } = body

    if (!html) {
      return createValidationErrorResponse('HTML is required')
    }

    // Get backend auth token
    const token = await getDeepCopyAccessToken()

    // Prepare request body for backend
    const backendBody: any = {
      html,
      ...(deepResearch && { deepResearch }),
      ...(angle && { angle }),
      ...(productName && { productName }),
      ...(avatar && { avatar }),
      ...(productImage && { productImage }),
      ...(language && { language }),
      ...(targetAge && { targetAge }),
    }

    // Call backend API
    const response = await fetch(`${BACKEND_API_URL}prelander-images/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(backendBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData: any
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText }
      }
      return NextResponse.json(
        { error: errorData.error || `Backend API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return createSuccessResponse(data)
  } catch (error) {
    return handleApiError(error)
  }
}

