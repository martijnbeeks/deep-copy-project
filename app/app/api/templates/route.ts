import { NextRequest } from 'next/server'
import { getTemplates } from '@/lib/db/queries'
import { handleApiError, createSuccessResponse } from '@/lib/middleware/error-handler'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const search = searchParams.get('search') || undefined

    const templates = await getTemplates({ category, search })

    return createSuccessResponse({ templates })
  } catch (error) {
    logger.error('Templates fetch error:', error)
    return handleApiError(error)
  }
}
