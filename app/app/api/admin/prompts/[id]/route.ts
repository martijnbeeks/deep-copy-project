import { NextRequest } from 'next/server'
import { verifyAdminAuth, createAuthResponse } from '@/lib/auth/admin-auth'
import { getPromptById, getPromptVersions } from '@/lib/db/queries'
import { createSuccessResponse, createValidationErrorResponse, handleApiError } from '@/lib/middleware/error-handler'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const prompt = await getPromptById(params.id)
    if (!prompt) {
      return createValidationErrorResponse('Prompt not found', 404)
    }

    const versions = await getPromptVersions(params.id)
    return createSuccessResponse({
      prompt,
      versions,
      latest_version: versions[0] || null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
