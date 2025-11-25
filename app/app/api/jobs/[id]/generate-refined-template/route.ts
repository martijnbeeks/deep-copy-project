import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { getInjectableTemplateById, createInjectedTemplate, getInjectableTemplateIdForTemplate } from '@/lib/db/queries'
import { extractContentFromSwipeResult, injectContentIntoTemplate } from '@/lib/utils/template-injection'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { logger } from '@/lib/utils/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
    const { templateId, angle } = await request.json()

    if (!templateId || !angle) {
      return createValidationErrorResponse('templateId and angle are required')
    }

    // Get job result data
    const resultQuery = await query(
      `SELECT metadata FROM results WHERE job_id = $1`,
      [jobId]
    )

    if (resultQuery.rows.length === 0) {
      return createValidationErrorResponse('Job result not found', 404)
    }

    const metadata = resultQuery.rows[0].metadata
    const fullResult = metadata?.full_result || metadata
    const swipeResults = fullResult?.results?.swipe_results || fullResult?.swipe_results || []
    const marketingAngles = fullResult?.results?.marketing_angles || []

    // Helper: Normalize text for comparison (handle newlines, extra spaces)
    const normalize = (text: string): string => {
      return text.toLowerCase().trim().replace(/\s+/g, ' ').replace(/\n/g, ' ')
    }

    // Helper: Extract angle text from marketing angle (string or object)
    const getAngleText = (ma: any): string => {
      if (typeof ma === 'string') return ma
      return ma.angle || ma.title || ''
    }

    // Helper: Extract description from combined format like "Title: 'Description'" or just return the text
    const extractDescription = (text: string): string => {
      // Handle format: "Title: 'Description'" or "Title: Description"
      if (text.includes(':')) {
        const afterColon = text.split(':').slice(1).join(':').trim()
        if (afterColon) {
          // Remove quotes if present (both single and double quotes)
          return afterColon.replace(/^['"]+|['"]+$/g, '').trim()
        }
      }
      return text
    }

    // Find the swipe result for the selected angle
    let swipeResult: any = null
    let angleIndex = -1
    const normalizedSelectedAngle = normalize(angle)
    const normalizedSelectedDescription = normalize(extractDescription(angle))

    // Strategy 1: Match by index in marketing_angles array (most reliable)
    // Marketing angles and swipe_results should be in the same order
    const marketingAngleIndex = marketingAngles.findIndex((ma: any) => {
      if (typeof ma === 'string') {
        const normalizedMA = normalize(ma)
        return normalizedMA === normalizedSelectedAngle ||
          normalizedMA === normalizedSelectedDescription ||
          normalizedMA.includes(normalizedSelectedAngle) ||
          normalizedSelectedAngle.includes(normalizedMA) ||
          normalizedMA.includes(normalizedSelectedDescription) ||
          normalizedSelectedDescription.includes(normalizedMA)
      }

      // For object format, check both angle and title properties
      const maAngle = ma.angle ? normalize(ma.angle) : ''
      const maTitle = ma.title ? normalize(ma.title) : ''

      // Match against full selected angle or extracted description
      return (maAngle && (maAngle === normalizedSelectedAngle ||
        maAngle === normalizedSelectedDescription ||
        maAngle.includes(normalizedSelectedAngle) ||
        normalizedSelectedAngle.includes(maAngle) ||
        maAngle.includes(normalizedSelectedDescription) ||
        normalizedSelectedDescription.includes(maAngle))) ||
        (maTitle && (maTitle === normalizedSelectedAngle ||
          normalizedSelectedAngle.includes(maTitle) ||
          maTitle.includes(normalizedSelectedAngle)))
    })

    if (marketingAngleIndex >= 0 && swipeResults[marketingAngleIndex]) {
      swipeResult = swipeResults[marketingAngleIndex]
      angleIndex = marketingAngleIndex
    } else {
      // Strategy 2: Fallback - match by text in swipe results
      const foundIndex = swipeResults.findIndex((swipe: any) => {
        const swipeAngle = swipe?.angle || swipe?.angle_name || ''
        if (!swipeAngle) return false
        const normalizedSwipe = normalize(swipeAngle)
        return normalizedSwipe === normalizedSelectedAngle ||
          normalizedSwipe === normalizedSelectedDescription ||
          normalizedSwipe.includes(normalizedSelectedAngle) ||
          normalizedSelectedAngle.includes(normalizedSwipe) ||
          normalizedSwipe.includes(normalizedSelectedDescription) ||
          normalizedSelectedDescription.includes(normalizedSwipe)
      })

      if (foundIndex >= 0) {
        swipeResult = swipeResults[foundIndex]
        angleIndex = foundIndex
      }
    }

    if (!swipeResult) {
      // Log available angles for debugging
      const availableAngles = swipeResults.map((swipe: any, idx: number) => ({
        index: idx,
        angle: swipe?.angle || swipe?.angle_name || `Angle ${idx + 1}`,
      }))

      const availableMarketingAngles = marketingAngles.map((ma: any, idx: number) => {
        if (typeof ma === 'string') return { index: idx, text: ma }
        return { index: idx, title: ma.title, angle: ma.angle }
      })

      logger.error('❌ Angle matching failed:')
      logger.error('Selected angle:', angle)
      logger.error('Available swipe angles:', JSON.stringify(availableAngles, null, 2))
      logger.error('Available marketing angles:', JSON.stringify(availableMarketingAngles, null, 2))

      return createValidationErrorResponse(
        `Marketing angle "${angle}" not found in job results`,
        404
      )
    }

    // Get job advertorial type once (DRY principle)
    const jobQuery = await query(
      `SELECT advertorial_type FROM jobs WHERE id = $1`,
      [jobId]
    )
    const advertorialType = jobQuery.rows[0]?.advertorial_type || 'advertorial'

    // Get injectable template
    let injectableTemplates = await getInjectableTemplateById(templateId)

    if (!injectableTemplates || injectableTemplates.length === 0) {
      const injectableTemplateId = await getInjectableTemplateIdForTemplate(templateId)
      if (injectableTemplateId) {
        injectableTemplates = await getInjectableTemplateById(injectableTemplateId)
      }
    }

    if (!injectableTemplates || injectableTemplates.length === 0) {
      const fallbackResult = await query(
        `SELECT * FROM injectable_templates WHERE advertorial_type = $1 ORDER BY created_at DESC LIMIT 1`,
        [advertorialType]
      )
      if (fallbackResult.rows.length > 0) {
        injectableTemplates = fallbackResult.rows
      }
    }

    if (!injectableTemplates || injectableTemplates.length === 0) {
      return createValidationErrorResponse(`No injectable template found for template ${templateId}`, 404)
    }

    const injectableTemplate = injectableTemplates[0]

    // Extract content from swipe result
    const contentData = extractContentFromSwipeResult(swipeResult, advertorialType)

    // Inject content into template
    const injectedHtml = injectContentIntoTemplate(injectableTemplate, contentData)

    // Use the angle index we found (1-based for database)
    const finalAngleIndex = angleIndex >= 0 ? angleIndex + 1 : swipeResults.length + 1

    // Store in database
    const storedTemplate = await createInjectedTemplate(
      jobId,
      angle,
      templateId,
      injectedHtml,
      finalAngleIndex
    )

    return createSuccessResponse({
      success: true,
      template: {
        id: storedTemplate.id,
        angle,
        templateId,
        html: injectedHtml
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}

