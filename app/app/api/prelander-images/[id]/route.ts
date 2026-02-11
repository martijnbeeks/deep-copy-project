import { NextRequest, NextResponse } from 'next/server'
import { getDeepCopyAccessToken } from '@/lib/auth/deepcopy-auth'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError } from '@/lib/middleware/error-handler'

const BACKEND_API_URL = 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Get backend auth token
    const token = await getDeepCopyAccessToken()

    // Call backend status API
    const response = await fetch(`${BACKEND_API_URL}prelander-images/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
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
    return NextResponse.json(data)
  } catch (error) {
    return handleApiError(error)
  }
}

