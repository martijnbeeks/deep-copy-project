import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { deepCopyClient } from '@/lib/clients/deepcopy-client'
import { updateJobStatus, updateJobAvatars, createResult, updateJobScreenshot } from '@/lib/db/queries'
import { storeJobResults } from '@/lib/utils/job-results'
import { getInjectableTemplateForJob } from '@/lib/utils/job-results-helpers'
import { handleApiError, createValidationErrorResponse, createSuccessResponse } from '@/lib/middleware/error-handler'
import { logger } from '@/lib/utils/logger'
import { transformV2ToExistingSchema } from '@/lib/utils/v2-data-transformer'
import { isDevMode } from '@/lib/utils/env'
import { JOB_CREDITS_BY_TYPE } from '@/lib/constants/job-credits'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id

    // Get job from database
    const result = await query(`
      SELECT id, execution_id, status, target_approach
      FROM jobs 
      WHERE id = $1
    `, [jobId])

    if (result.rows.length === 0) {
      return createValidationErrorResponse('Job not found', 404)
    }

    const job = result.rows[0]
    const isV2Job = job.target_approach === 'v2'

    // Use execution_id if available (jobs submitted to DeepCopy have this set),
    // otherwise use the job ID directly (for jobs created with DeepCopy job ID as primary key)
    const deepCopyJobId = job.execution_id || jobId

    // Get current database status first
    const currentJob = await query(`
      SELECT status, progress, updated_at 
      FROM jobs 
      WHERE id = $1
    `, [jobId])

    const dbStatus = currentJob.rows[0]

    // Poll the DeepCopy API using the correct endpoint based on job type
    let statusResponse
    try {
      if (isV2Job) {
        // Use V2 API endpoint
        statusResponse = await deepCopyClient.getV2Status(deepCopyJobId)
      } else {
        // Use V1 API endpoint
        statusResponse = await deepCopyClient.getMarketingAngleStatus(deepCopyJobId)
      }
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

      // Get results and store them using the correct method
      try {
        if (isV2Job) {
          // V2: Get results, transform avatars, and store
          const result = await deepCopyClient.getV2Result(deepCopyJobId)
          await storeV2JobResults(jobId, result, deepCopyJobId)
        } else {
          // V1: Store results as-is
          const result = await deepCopyClient.getMarketingAngleResult(deepCopyJobId)
          await storeJobResults(jobId, result, deepCopyJobId)
        }
      } catch (resultError) {
        logger.error('❌ Error fetching/storing job results:', resultError)
        // Continue even if result fetching fails
      }

      // Record job credit event (event-based billing)
      try {
        const jobRow = await query('SELECT user_id, is_avatar_job FROM jobs WHERE id = $1', [jobId])
        if (jobRow.rows[0]) {
          const { recordJobCreditEvent } = await import('@/lib/services/billing')
          // V2 jobs and avatar research jobs use deep_research credits; marketing angle completion uses pre_lander
          const jobType = isV2Job || jobRow.rows[0].is_avatar_job ? 'deep_research' : 'pre_lander'
          const credits = JOB_CREDITS_BY_TYPE[jobType]
          await recordJobCreditEvent({ userId: jobRow.rows[0].user_id, jobId, jobType, credits })
        }
      } catch (creditErr) {
        logger.error('❌ Failed to record job credit event:', creditErr)
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

// Strip null bytes from strings/objects/arrays (used in dev mode to avoid DB errors)
function stripNulls(value: any): any {
  if (typeof value === 'string') return value.replace(/\u0000/g, '')
  if (Array.isArray(value)) return value.map(stripNulls)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripNulls(v)]))
  }
  return value
}

// Store V2 job results in database
async function storeV2JobResults(localJobId: string, result: any, deepCopyJobId: string) {
  try {
    const sanitizedResult = isDevMode() ? stripNulls(result) : result

    // Transform V2 avatars to existing schema format
    const transformedAvatars = transformV2ToExistingSchema(sanitizedResult)
    const sanitizedAvatars = isDevMode() ? stripNulls(transformedAvatars) : transformedAvatars

    // Update job with transformed avatars
    await updateJobAvatars(localJobId, sanitizedAvatars)

    // Persist product image (DeepCopy screenshot) to reuse across sessions
    const productImage = sanitizedResult?.results?.product_image || sanitizedResult?.product_image
    if (productImage && typeof productImage === 'string') {
      await updateJobScreenshot(localJobId, productImage)
    }

    // Store the complete JSON result as metadata
    await createResult(localJobId, '', {
      deepcopy_job_id: deepCopyJobId,
      full_result: sanitizedResult,
      project_name: sanitizedResult.project_name,
      timestamp_iso: sanitizedResult.timestamp_iso,
      job_id: sanitizedResult.job_id,
      api_version: sanitizedResult.api_version || 'v2',
      generated_at: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error storing V2 job results:', error)
    throw error
  }
}

async function generateAndStoreInjectedTemplates(jobId: string, result: any) {
  try {

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

    // Get the injectable template using shared helper
    const injectableTemplate = await getInjectableTemplateForJob(job)

    if (!injectableTemplate) {
      logger.error('❌ No injectable template found for job:', jobId, 'template_id:', job.template_id)
      return { success: false, error: `No injectable template found for template_id: ${job.template_id}` }
    }


    // Check if we have swipe_results in the result
    const apiResult = result.results || result

    // Look for swipe_results in the correct location
    let swipeResults = apiResult.swipe_results || []


    // If swipeResults is an object, convert it to an array
    if (swipeResults && typeof swipeResults === 'object' && !Array.isArray(swipeResults)) {
      swipeResults = Object.values(swipeResults)
    }

    if (!swipeResults || !Array.isArray(swipeResults) || swipeResults.length === 0) {
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

          // Import template injection utilities
          const { extractContentFromSwipeResult, injectContentIntoTemplate } = await import('@/lib/utils/template-injection')

          // Extract content from swipe result
          // Handle both { full_advertorial: {...} } and direct content
          const swipeContent = (swipeResult as any).full_advertorial || swipeResult
          
          // Extract config_data - this is the full_advertorial object that contains image prompts
          // For new templates (AD0001, LD0001), this will have article.heroImagePrompt, sections[].imagePrompt, product.imagePrompt
          const configData = swipeContent && typeof swipeContent === 'object' ? swipeContent : null
          
          const contentData = extractContentFromSwipeResult(swipeContent, job.advertorial_type, job.template_id)
          // Inject content into template
          const injectedHtml = injectContentIntoTemplate(injectableTemplate, contentData, job.template_id)

          // Store the injected template with config_data
          const configDataJson = configData ? JSON.stringify(configData) : null
          await query(`
            INSERT INTO injected_templates (job_id, angle_index, angle_name, html_content, template_id, config_data)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [jobId, i + 1, angle || `Angle ${i + 1}`, injectedHtml, job.template_id, configDataJson])

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
