import { NextRequest } from 'next/server'
import { verifyAdminAuth, createAuthResponse } from '@/lib/auth/admin-auth'
import { getAllPrompts, getPromptById, createPromptVersion, validatePlaceholders } from '@/lib/db/queries'
import { createSuccessResponse, createValidationErrorResponse, handleApiError } from '@/lib/middleware/error-handler'

export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const prompts = await getAllPrompts(category)
    return createSuccessResponse({ prompts })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const { promptId, content, notes } = await request.json()

    if (!promptId) {
      return createValidationErrorResponse('promptId is required')
    }
    if (!content || !content.trim()) {
      return createValidationErrorResponse('content is required')
    }

    const prompt = await getPromptById(promptId)
    if (!prompt) {
      return createValidationErrorResponse('Prompt not found', 404)
    }

    const validation = validatePlaceholders(content, prompt.required_params || [])
    if (!validation.valid) {
      const problems: string[] = []
      if (validation.missing.length > 0) {
        problems.push(`Missing required placeholders: ${validation.missing.join(', ')}`)
      }
      if (validation.extra.length > 0) {
        problems.push(`Unknown placeholders: ${validation.extra.join(', ')}`)
      }
      return createValidationErrorResponse(problems.join('. '))
    }

    const createdBy = authResult.user?.email || authResult.user?.username || 'admin'
    const version = await createPromptVersion(promptId, content, createdBy, notes)
    return createSuccessResponse({ version, placeholders: validation.found, validation })
  } catch (error) {
    return handleApiError(error)
  }
}
