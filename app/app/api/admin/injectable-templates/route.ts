import { NextRequest, NextResponse } from 'next/server'
import {
  getInjectableTemplates,
  getInjectableTemplateById,
  createInjectableTemplate,
  updateInjectableTemplate,
  deleteInjectableTemplate
} from '@/lib/db/queries'
import { verifyAdminAuth, createAuthResponse } from '@/lib/auth/admin-auth'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'listicle' | 'advertorial' | null
    const id = searchParams.get('id')

    let templates
    if (id) {
      // Fetch specific template by ID
      templates = await getInjectableTemplateById(id)
    } else {
      // Fetch templates by type (convert null to undefined)
      templates = await getInjectableTemplates(type ?? undefined)
    }

    return createSuccessResponse(templates)
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
    const body = await request.json()
    const { id, name, type, htmlContent, description } = body

    if (!name || !type || !htmlContent) {
      return createValidationErrorResponse('Name, type, and HTML content are required')
    }

    if (!['listicle', 'advertorial'].includes(type)) {
      return createValidationErrorResponse('Type must be either "listicle" or "advertorial"')
    }

    const template = await createInjectableTemplate(name, type, htmlContent, description, id)
    return createSuccessResponse({ template })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const body = await request.json()
    const { id, name, type, htmlContent, description, is_active } = body

    if (!id) {
      return createValidationErrorResponse('Template ID is required')
    }

    if (!name || !type || !htmlContent) {
      return createValidationErrorResponse('Name, type, and HTML content are required')
    }

    if (!['listicle', 'advertorial'].includes(type)) {
      return createValidationErrorResponse('Type must be either "listicle" or "advertorial"')
    }

    const template = await updateInjectableTemplate(id, {
      name,
      html_content: htmlContent,
      description,
      advertorial_type: type,
      is_active: is_active !== undefined ? is_active : true
    })

    if (!template) {
      return createValidationErrorResponse('Template not found', 404)
    }

    return createSuccessResponse({ template })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return createValidationErrorResponse('Template ID is required')
  }

  try {
    const success = await deleteInjectableTemplate(id)
    if (!success) {
      return createValidationErrorResponse('Template not found', 404)
    }

    return createSuccessResponse({ success: true, message: 'Injectable template deleted successfully' })
  } catch (error) {
    return handleApiError(error)
  }
}
