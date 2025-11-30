import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { deepCopyClient } from '@/lib/clients/deepcopy-client'
import { updateJobStatus } from '@/lib/db/queries'
import { storeJobResults } from '@/lib/utils/job-results'
import { getInjectableTemplateForJob } from '@/lib/utils/job-results-helpers'
import { handleApiError, createValidationErrorResponse, createSuccessResponse } from '@/lib/middleware/error-handler'
import { logger } from '@/lib/utils/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const marketingAngleId = params.id

    // Get marketing angle from database
    const result = await query(`
      SELECT id, execution_id, status 
      FROM jobs 
      WHERE id = $1
    `, [marketingAngleId])

    if (result.rows.length === 0) {
      return createValidationErrorResponse('Marketing angle not found', 404)
    }

    const marketingAngle = result.rows[0]

    // Use execution_id if available (jobs submitted to DeepCopy have this set),
    // otherwise use the job ID directly (for jobs created with DeepCopy job ID as primary key)
    const deepCopyJobId = marketingAngle.execution_id || marketingAngleId

    // Get current database status first
    const currentMarketingAngle = await query(`
      SELECT status, progress, updated_at 
      FROM jobs 
      WHERE id = $1
    `, [marketingAngleId])

    const dbStatus = currentMarketingAngle.rows[0]

    // Always poll the DeepCopy API to get the real status
    // Don't skip API calls even for completed marketing angles

    // Poll the DeepCopy API only if marketing angle is not completed
    let statusResponse
    try {
      statusResponse = await deepCopyClient.getMarketingAngleStatus(deepCopyJobId)
    } catch (apiError) {
      logger.error('❌ DeepCopy API Error in status check:', apiError)
      // If API call fails, return current database status instead of error
      const errorResponse = createSuccessResponse({
        status: dbStatus.status,
        progress: dbStatus.progress,
        updated_at: dbStatus.updated_at,
        deepcopy_status: 'API_ERROR',
        deepcopy_response: { error: 'Failed to poll DeepCopy API', details: apiError instanceof Error ? apiError.message : String(apiError) }
      })
      errorResponse.headers.set('X-Timestamp', Date.now().toString())
      return errorResponse
    }

    // Update our database with the status
    if (statusResponse.status === 'SUCCEEDED') {
      // Get results and store them first, before marking as completed
      try {
        logger.log(`🔄 Fetching results for marketing angle ${marketingAngleId}`)
        const result = await deepCopyClient.getMarketingAngleResult(deepCopyJobId)

        logger.log(`🔄 Storing results for marketing angle ${marketingAngleId}`)
        await storeJobResults(marketingAngleId, result, deepCopyJobId)

        // Only mark as completed after successful result storage
        await updateJobStatus(marketingAngleId, 'completed', 100)
        logger.log(`✅ Successfully completed marketing angle ${marketingAngleId}`)

      } catch (resultError) {
        logger.error('❌ Error fetching/storing marketing angle results:', resultError)
        logger.error('❌ Full error details:', {
          error: resultError instanceof Error ? resultError.message : String(resultError),
          stack: resultError instanceof Error ? resultError.stack : undefined,
          marketingAngleId,
          deepCopyJobId
        })

        // Mark as failed if we can't store results
        await updateJobStatus(marketingAngleId, 'failed')

        // Return error response instead of continuing
        const errorResponse = createSuccessResponse({
          status: 'failed',
          progress: 0,
          updated_at: new Date().toISOString(),
          deepcopy_status: statusResponse.status,
          deepcopy_response: statusResponse,
          error: 'Failed to fetch or store marketing angle results',
          error_details: resultError instanceof Error ? resultError.message : String(resultError)
        })
        errorResponse.headers.set('X-Timestamp', Date.now().toString())
        return errorResponse
      }

    } else if (statusResponse.status === 'FAILED') {
      await updateJobStatus(marketingAngleId, 'failed')

    } else if (['RUNNING', 'SUBMITTED', 'PENDING'].includes(statusResponse.status)) {
      const progress = statusResponse.status === 'SUBMITTED' ? 25 :
        statusResponse.status === 'RUNNING' ? 50 : 30
      await updateJobStatus(marketingAngleId, 'processing', progress)
    }

    // Get updated marketing angle status from database
    const updatedMarketingAngle = await query(`
      SELECT status, progress, updated_at 
      FROM jobs 
      WHERE id = $1
    `, [marketingAngleId])

    const currentStatus = updatedMarketingAngle.rows[0]

    // Check if templates are missing for completed marketing angles
    if (currentStatus.status === 'completed') {
      const templateCount = await query(`
        SELECT COUNT(*) as count
        FROM injected_templates 
        WHERE job_id = $1
      `, [marketingAngleId])

      const count = parseInt(templateCount.rows[0].count)
      if (count === 0) {
        logger.log(`🔧 No templates found for completed marketing angle ${marketingAngleId}, generating...`)
        try {
          // Get the result from the results table instead of calling DeepCopy API
          const resultData = await query(`
            SELECT metadata
            FROM results 
            WHERE job_id = $1
            LIMIT 1
          `, [marketingAngleId])

          if (resultData.rows.length > 0) {
            const metadata = resultData.rows[0].metadata
            const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
            const result = parsedMetadata.full_result
            const templateResult = await generateAndStoreInjectedTemplates(marketingAngleId, result)
            logger.log('📊 Template generation result:', templateResult)
          } else {
            logger.error('❌ No result data found in database for marketing angle:', marketingAngleId)
            logger.log('🔄 Attempting to re-fetch results from DeepCopy API...')

            // Try to re-fetch and store results if they're missing
            try {
              const result = await deepCopyClient.getMarketingAngleResult(deepCopyJobId)
              await storeJobResults(marketingAngleId, result, deepCopyJobId)
              logger.log('✅ Successfully re-fetched and stored missing results')

              // Try template generation again
              const templateResult = await generateAndStoreInjectedTemplates(marketingAngleId, result)
              logger.log('📊 Template generation result after re-fetch:', templateResult)
            } catch (refetchError) {
              logger.error('❌ Failed to re-fetch results from DeepCopy API:', refetchError)
            }
          }
        } catch (error) {
          logger.error('❌ Error generating templates for completed marketing angle:', error)
        }
      }
    }

    const response = createSuccessResponse({
      status: currentStatus.status,
      progress: currentStatus.progress || 0,
      updated_at: currentStatus.updated_at,
      deepcopy_status: statusResponse.status,
      deepcopy_response: statusResponse
    })
    response.headers.set('X-Timestamp', Date.now().toString())
    return response

  } catch (error) {
    return handleApiError(error)
  }
}

// Use shared utilities from lib/utils/job-results

async function generateAndStoreInjectedTemplates(marketingAngleId: string, result: any) {
  try {
    logger.log(`🔧 Starting injected template generation for marketing angle ${marketingAngleId}`)

    // Get marketing angle details to find template_id and advertorial_type
    const marketingAngleResult = await query(`
      SELECT template_id, advertorial_type, title
      FROM jobs 
      WHERE id = $1
    `, [marketingAngleId])

    if (marketingAngleResult.rows.length === 0) {
      logger.error('❌ Marketing angle not found for injected template generation:', marketingAngleId)
      return { success: false, error: 'Marketing angle not found' }
    }

    const marketingAngle = marketingAngleResult.rows[0]
    logger.log(`📊 Marketing angle details: template_id=${marketingAngle.template_id}, type=${marketingAngle.advertorial_type}`)

    // Get the injectable template using shared helper
    const injectableTemplate = await getInjectableTemplateForJob(marketingAngle)

    if (!injectableTemplate) {
      logger.error('❌ No injectable template found for marketing angle:', marketingAngleId, 'template_id:', marketingAngle.template_id)
      return { success: false, error: `No injectable template found for template_id: ${marketingAngle.template_id}` }
    }

    logger.log(`✅ Found injectable template: ${injectableTemplate.id}`)

    // Check if we have swipe_results in the result
    const apiResult = result.results || result
    logger.log(`📊 API Result structure:`, Object.keys(apiResult))

    // Look for swipe_results in the correct location
    let swipeResults = apiResult.swipe_results || []

    logger.log(`📊 Swipe results found:`, swipeResults ? swipeResults.length : 0)

    // If swipeResults is an object, convert it to an array
    if (swipeResults && typeof swipeResults === 'object' && !Array.isArray(swipeResults)) {
      swipeResults = Object.values(swipeResults)
      logger.log(`📊 Converted object to array, length:`, swipeResults.length)
    }

    if (!swipeResults || !Array.isArray(swipeResults) || swipeResults.length === 0) {
      logger.log('ℹ️ No swipe_results found for marketing angle:', marketingAngleId, '- This is expected. Swipe files are generated separately via /swipe-files/generate endpoint.')
      logger.log('ℹ️ Available keys in apiResult:', Object.keys(apiResult))
      return {
        success: true,
        generated: 0,
        total: 0,
        errors: 0,
        message: 'Marketing angle completed successfully. Swipe files can be generated separately by selecting a marketing angle.'
      }
    }

    // Extract angles from swipe results
    const angles = swipeResults.map((swipe, index) => {
      if (swipe && typeof swipe === 'object') {
        return swipe.angle || swipe.angle_name || `Angle ${index + 1}`
      }
      return `Angle ${index + 1}`
    })

    logger.log(`Generating injected templates for marketing angle ${marketingAngleId} with ${angles.length} angles`)

    // Create injected_templates table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS injected_templates (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        angle_index INTEGER NOT NULL,
        angle_name VARCHAR(255) NOT NULL,
        html_content TEXT NOT NULL,
        template_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Process each angle
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < angles.length; i++) {
      const angle = angles[i]
      const swipeResult = swipeResults[i]

      if (swipeResult) {
        try {
          logger.log(`🔧 Processing angle ${i + 1}/${angles.length}: ${angle}`)

          // Import template injection utilities
          const { extractContentFromSwipeResult, injectContentIntoTemplate } = await import('@/lib/utils/template-injection')

          // Extract content from swipe result
          const contentData = extractContentFromSwipeResult(swipeResult, marketingAngle.advertorial_type)
          logger.log(`📊 Content data extracted for angle ${i + 1}`)

          // Inject content into template
          const injectedHtml = injectContentIntoTemplate(injectableTemplate, contentData)
          logger.log(`📊 Template injected for angle ${i + 1}, HTML length: ${injectedHtml.length}`)

          // Store the injected template
          await query(`
            INSERT INTO injected_templates (job_id, angle_index, angle_name, html_content, template_id)
            VALUES ($1, $2, $3, $4, $5)
          `, [marketingAngleId, i + 1, angle || `Angle ${i + 1}`, injectedHtml, marketingAngle.template_id])

          logger.log(`✅ Generated injected template for angle ${i + 1}: ${angle}`)
          successCount++
        } catch (error) {
          logger.error(`❌ Error generating injected template for angle ${i + 1}:`, error)
          errorCount++
        }
      } else {
        logger.error(`❌ No swipe result data for angle ${i + 1}`)
        errorCount++
      }
    }

    logger.log(`✅ Generated ${successCount}/${angles.length} injected templates for marketing angle ${marketingAngleId}`)
    if (errorCount > 0) {
      logger.error(`❌ Failed to generate ${errorCount} templates`)
    }

    return {
      success: successCount > 0,
      generated: successCount,
      total: angles.length,
      errors: errorCount
    }
  } catch (error) {
    logger.error('❌ Error generating injected templates:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
