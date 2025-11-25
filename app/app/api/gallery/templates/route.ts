import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { extractContentFromSwipeResult, injectContentIntoTemplate } from '@/lib/utils/template-injection'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }
    const user = authResult.user

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '6') // Proper pagination - 6 templates per page
    const offset = (page - 1) * limit

    logger.log(`🔍 Fetching gallery templates for user: ${user.email} (ID: ${user.id})`)

    // Get completed jobs with their results metadata - SAME LOGIC AS RESULTS PAGE
    const jobsResult = await query(`
      SELECT 
        j.id,
        j.title,
        j.status,
        j.advertorial_type,
        j.template_id,
        j.created_at,
        r.metadata,
        t.name as template_name
      FROM jobs j
      LEFT JOIN results r ON j.id = r.job_id
      LEFT JOIN templates t ON j.template_id = t.id
      WHERE j.user_id = $1 
        AND j.status = 'completed' 
        AND r.metadata IS NOT NULL
      ORDER BY j.created_at DESC
      LIMIT $2 OFFSET $3
    `, [user.id, limit, offset])

    console.log(`📊 Found ${jobsResult.rows.length} completed jobs with results`)

    // Get total count for pagination
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM jobs j
      LEFT JOIN results r ON j.id = r.job_id
      WHERE j.user_id = $1 
        AND j.status = 'completed' 
        AND r.metadata IS NOT NULL
    `, [user.id])

    const total = parseInt(countResult.rows[0].total)
    const hasMore = offset + limit < total

    // Generate templates dynamically - EXACT SAME LOGIC AS RESULTS PAGE
    const templates: Array<{
      id: string
      jobId: string
      jobTitle: string
      templateName: string
      angle: string
      html: string
      createdAt: string
      status: string
      advertorialType: string
      thumbnail: string
    }> = []
    logger.log(`🔄 Generating templates dynamically for ${jobsResult.rows.length} jobs`)

    for (const job of jobsResult.rows) {
      try {
        logger.log(`🔍 Processing job ${job.id}: ${job.title}`)

        // Check if job has result with swipe_results - SAME AS RESULTS PAGE
        if (job.metadata?.full_result?.results?.swipe_results) {
          const swipeResults = job.metadata.full_result.results.swipe_results
          logger.log(`📊 Found ${swipeResults.length} swipe results for job ${job.id}`)

          // Get injectable template for this job - SAME LOGIC AS RESULTS PAGE
          const templateType = job.advertorial_type === 'listicle' ? 'listicle' : 'advertorial'
          let injectableTemplate = null

          try {
            if (job.template_id) {
              // Try to fetch the specific injectable template with the same ID
              logger.log(`🔍 Looking for injectable template with ID: ${job.template_id}`)
              const specificResponse = await query(`
                SELECT * FROM injectable_templates WHERE id = $1
              `, [job.template_id])

              if (specificResponse.rows.length > 0) {
                injectableTemplate = specificResponse.rows[0]
                logger.log(`✅ Found specific injectable template: ${injectableTemplate.name}`)
              }
            }

            // Fallback: fetch by type if specific template not found
            if (!injectableTemplate) {
              logger.log(`⚠️ Specific template not found, fetching by type: ${templateType}`)
              const typeResponse = await query(`
                SELECT * FROM injectable_templates WHERE advertorial_type = $1 LIMIT 1
              `, [templateType])

              if (typeResponse.rows.length > 0) {
                injectableTemplate = typeResponse.rows[0]
                logger.log(`✅ Using fallback injectable template: ${injectableTemplate.name}`)
              }
            }
          } catch (error) {
            logger.error('❌ Error fetching injectable templates:', error)
            continue // Skip this job
          }

          if (injectableTemplate) {
            // Process each swipe result to create templates - SAME LOGIC AS RESULTS PAGE
            swipeResults.forEach((swipeResult: any, index: number) => {
              try {
                // Extract content from the individual swipe result
                const contentData = extractContentFromSwipeResult(swipeResult, templateType)

                // Inject content into the injectable template
                const renderedHtml = injectContentIntoTemplate(injectableTemplate, contentData)

                templates.push({
                  id: `${job.id}-${index + 1}`,
                  jobId: job.id,
                  jobTitle: job.title,
                  templateName: job.template_name || injectableTemplate.name || 'Unknown Template',
                  angle: swipeResult.angle || `Angle ${index + 1}`,
                  html: renderedHtml,
                  createdAt: job.created_at,
                  status: job.status,
                  advertorialType: job.advertorial_type || 'unknown',
                  thumbnail: generateThumbnail(renderedHtml)
                })

                logger.log(`✅ Generated template for angle ${index + 1}: ${swipeResult.angle}`)
              } catch (error) {
                logger.error(`❌ Error processing angle ${index + 1} for job ${job.id}:`, error)
              }
            })
          } else {
            logger.log(`⚠️ No injectable template found for job ${job.id}, skipping`)
          }
        } else {
          logger.log(`⚠️ Job ${job.id} has no swipe_results, skipping`)
        }
      } catch (error) {
        logger.error(`❌ Error processing job ${job.id}:`, error)
      }
    }

    logger.log(`🎉 Generated ${templates.length} templates from ${jobsResult.rows.length} jobs`)

    return createSuccessResponse({
      templates,
      total,
      hasMore,
      page,
      limit,
      source: 'dynamic_generation'
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// Simple thumbnail generator
function generateThumbnail(html: string): string {
  // Extract first image or return a placeholder
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
  if (imgMatch) {
    return imgMatch[1]
  }
  return 'https://placehold.co/300x200?text=Template+Preview'
}