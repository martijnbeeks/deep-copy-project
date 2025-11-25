import { NextRequest } from 'next/server'
import { getDeepCopyAccessToken } from '@/lib/auth/deepcopy-auth'
import { handleApiError, createValidationErrorResponse, createSuccessResponse } from '@/lib/middleware/error-handler'

const DEEPCOPY_API_URL = 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    if (!id) {
      return createValidationErrorResponse('Swipe file job ID is required')
    }

    const accessToken = await getDeepCopyAccessToken()

    const response = await fetch(`${DEEPCOPY_API_URL}swipe-files/${id}/result?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        return createValidationErrorResponse('Swipe file result not available')
      }
      const errorText = await response.text()
      throw new Error(`Swipe file result API responded with status: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return createSuccessResponse(data)

  } catch (error) {
    return handleApiError(error)
  }
}

