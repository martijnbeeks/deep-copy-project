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
    const jobId = params.id

    // Get job from database
    const result = await query(`
      SELECT id, execution_id, status 
      FROM jobs 
      WHERE id = $1
    `, [jobId])

    if (result.rows.length === 0) {
      return createValidationErrorResponse('Job not found', 404)
    }

    const job = result.rows[0]

    // Use the job ID directly as the DeepCopy job ID (since we now use DeepCopy job ID as primary key)
    const deepCopyJobId = jobId

    // Get current database status first
    const currentJob = await query(`
      SELECT status, progress, updated_at 
      FROM jobs 
      WHERE id = $1
    `, [jobId])

    const dbStatus = currentJob.rows[0]

    // Always poll the DeepCopy API to get the real status
    // Don't skip API calls even for completed jobs

    // Poll the DeepCopy API only if job is not completed
    let statusResponse
    try {
      statusResponse = await deepCopyClient.getJobStatus(deepCopyJobId)
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
      await updateJobStatus(jobId, 'completed', 100)

      // Get results and store them
      try {
        const result = await deepCopyClient.getJobResult(deepCopyJobId)
        await storeJobResults(jobId, result, deepCopyJobId)
      } catch (resultError) {
        logger.error('❌ Error fetching/storing job results:', resultError)
        // Continue even if result fetching fails
      }

    } else if (statusResponse.status === 'FAILED') {
      await updateJobStatus(jobId, 'failed')

    } else if (['RUNNING', 'SUBMITTED', 'PENDING'].includes(statusResponse.status)) {
      const progress = statusResponse.status === 'SUBMITTED' ? 25 :
        statusResponse.status === 'RUNNING' ? 50 : 30
      await updateJobStatus(jobId, 'processing', progress)
    }

    // Get updated job status from database
    const updatedJob = await query(`
      SELECT status, progress, updated_at 
      FROM jobs 
      WHERE id = $1
    `, [jobId])

    const currentStatus = updatedJob.rows[0]

    // Check if templates are missing for completed jobs
    if (currentStatus.status === 'completed') {
      const templateCount = await query(`
        SELECT COUNT(*) as count
        FROM injected_templates 
        WHERE job_id = $1
      `, [jobId])

      const count = parseInt(templateCount.rows[0].count)
      if (count === 0) {
        logger.log(`🔧 No templates found for completed job ${jobId}, generating...`)
        try {
          // Get the result from the results table instead of calling DeepCopy API
          const resultData = await query(`
            SELECT metadata
            FROM results 
            WHERE job_id = $1
            LIMIT 1
          `, [jobId])

          if (resultData.rows.length > 0) {
            const metadata = resultData.rows[0].metadata
            const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
            const result = parsedMetadata.full_result
            const templateResult = await generateAndStoreInjectedTemplates(jobId, result)
            logger.log('📊 Template generation result:', templateResult)
          } else {
            logger.error('❌ No result data found in database for job:', jobId)
          }
        } catch (error) {
          logger.error('❌ Error generating templates for completed job:', error)
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

async function generateAndStoreInjectedTemplates(jobId: string, result: any) {
  try {
    logger.log(`🔧 Starting injected template generation for job ${jobId}`)

    // Get job details to find template_id and advertorial_type
    const jobResult = await query(`
      SELECT template_id, advertorial_type, title
      FROM jobs 
      WHERE id = $1
    `, [jobId])

    if (jobResult.rows.length === 0) {
      logger.error('❌ Job not found for injected template generation:', jobId)
      return { success: false, error: 'Job not found' }
    }

    const job = jobResult.rows[0]
    logger.log(`📊 Job details: template_id=${job.template_id}, type=${job.advertorial_type}`)

    // Get the injectable template using shared helper
    const injectableTemplate = await getInjectableTemplateForJob(job)

    if (!injectableTemplate) {
      logger.error('❌ No injectable template found for job:', jobId, 'template_id:', job.template_id)
      return { success: false, error: `No injectable template found for template_id: ${job.template_id}` }
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
      logger.log('ℹ️ No swipe_results found for job:', jobId, '- This is expected. Swipe files are generated separately via /swipe-files/generate endpoint.')
      logger.log('ℹ️ Available keys in apiResult:', Object.keys(apiResult))
      return {
        success: true,
        generated: 0,
        total: 0,
        errors: 0,
        message: 'Job completed successfully. Swipe files can be generated separately by selecting a marketing angle.'
      }
    }

    // Extract angles from swipe results
    const angles = swipeResults.map((swipe, index) => {
      if (swipe && typeof swipe === 'object') {
        return swipe.angle || swipe.angle_name || `Angle ${index + 1}`
      }
      return `Angle ${index + 1}`
    })

    logger.log(`Generating injected templates for job ${jobId} with ${angles.length} angles`)

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
          const contentData = extractContentFromSwipeResult(swipeResult, job.advertorial_type)
          logger.log(`📊 Content data extracted for angle ${i + 1}`)

          // Inject content into template
          const injectedHtml = injectContentIntoTemplate(injectableTemplate, contentData)
          logger.log(`📊 Template injected for angle ${i + 1}, HTML length: ${injectedHtml.length}`)

          // Store the injected template
          await query(`
            INSERT INTO injected_templates (job_id, angle_index, angle_name, html_content, template_id)
            VALUES ($1, $2, $3, $4, $5)
          `, [jobId, i + 1, angle || `Angle ${i + 1}`, injectedHtml, job.template_id])

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

    logger.log(`✅ Generated ${successCount}/${angles.length} injected templates for job ${jobId}`)
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
