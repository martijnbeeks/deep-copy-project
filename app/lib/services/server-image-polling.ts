import { query } from '@/lib/db/connection'
import { logger } from '@/lib/utils/logger'
import { getDeepCopyAccessToken } from '@/lib/auth/deepcopy-auth'

const BACKEND_API_URL = 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/'

// Track which jobs are currently being polled to avoid duplicate processing
const activePollingJobs = new Set<string>()

export interface ImageGenerationJob {
  id: string
  external_job_id: string
  injected_template_id: string
  user_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  prompts: any
  created_at: string
  updated_at: string
  completed_at?: string
  result_images?: any
  error_message?: string
}

/**
 * Serverless-friendly: check DB for pending/processing jobs and poll each
 * one to completion (or failure). Called on-demand when the user opens the app.
 * Returns the list of pending job injected_template_ids so the UI can show indicators.
 */
export async function recoverPendingImageJobs(): Promise<string[]> {
  try {
    const result = await query(`
      SELECT id, external_job_id, injected_template_id, user_id, status, created_at
      FROM image_generation_jobs 
      WHERE status IN ('pending', 'processing')
      ORDER BY created_at ASC
    `)

    const pendingJobs = result.rows
    if (pendingJobs.length === 0) {
      return []
    }

    logger.info(`[ImageJobRecovery] Found ${pendingJobs.length} pending image job(s) to recover`)

    const activeTemplateIds: string[] = []

    for (const job of pendingJobs) {
      activeTemplateIds.push(job.injected_template_id)

      // Skip if already being polled (e.g. user refreshed while polling is in progress)
      if (activePollingJobs.has(job.external_job_id)) {
        logger.info(`[ImageJobRecovery] Job ${job.external_job_id} already being polled, skipping`)
        continue
      }

      // Fire-and-forget: poll this job to completion in the background
      pollJobToCompletion(job.id, job.external_job_id, job.injected_template_id, job.created_at)
    }

    return activeTemplateIds
  } catch (error) {
    logger.error('[ImageJobRecovery] Error checking for pending jobs:', error)
    return []
  }
}

/**
 * Poll a single job until it completes or fails. Runs as a background async task.
 * Uses 10s intervals, max 1 hour timeout.
 */
async function pollJobToCompletion(localJobId: string, externalJobId: string, injectedTemplateId: string, createdAt: string) {
  if (activePollingJobs.has(externalJobId)) {
    logger.info(`[ImageJobRecovery] Job ${externalJobId} is already being polled, skipping`)
    return
  }
  
  activePollingJobs.add(externalJobId)
  const POLL_INTERVAL = 10000 // 10 seconds
  const jobAgeMs = Date.now() - new Date(createdAt).getTime()
  
  logger.info(`[ImageJobRecovery] Starting to poll job ${externalJobId} (age: ${Math.round(jobAgeMs/1000/60)} minutes ago)`)

  try {
    while (true) {

      try {
        const token = await getDeepCopyAccessToken()

        const statusResponse = await fetch(`${BACKEND_API_URL}prelander-images/${externalJobId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (!statusResponse.ok) {
          logger.warn(`[ImageJobRecovery] Status check failed for ${externalJobId}: ${statusResponse.status}`)
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
          continue
        }

        const statusData = await statusResponse.json()

        if (statusData.status === 'COMPLETED_PRELANDER_IMAGE_GEN') {
          await handleJobCompleted(localJobId, externalJobId, injectedTemplateId)
          break
        } else if (statusData.status === 'FAILED_PRELANDER_IMAGE_GEN') {
          await handleJobFailed(localJobId, externalJobId, statusData.error || 'Backend reported failure')
          break
        } else {
          // Still running — update status and wait
          await updateJobStatus(localJobId, 'processing')
        }
      } catch (error) {
        logger.warn(`[ImageJobRecovery] Transient error polling ${externalJobId}:`, error)
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
    }
  } finally {
    activePollingJobs.delete(externalJobId)
  }
}

// Keep old name as alias so existing /api/image-jobs/track route still works
export function startServerImagePolling() {
  // No-op on serverless — recovery is triggered on-demand via recoverPendingImageJobs()
  recoverPendingImageJobs().catch(err => logger.error('[ImageJobRecovery] Error in auto-recovery:', err))
}

async function handleJobCompleted(localJobId: string, externalJobId: string, injectedTemplateId: string) {
  try {
    logger.info(`Image job completed: ${externalJobId}`)

    // Get backend auth token
    const token = await getDeepCopyAccessToken()

    // Get results from backend API
    const resultResponse = await fetch(`${BACKEND_API_URL}prelander-images/${externalJobId}/result?creditType=templates_images`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    })

    if (!resultResponse.ok) {
      throw new Error(`Result fetch failed: ${resultResponse.status}`)
    }

    const resultData = await resultResponse.json()

    if (resultData.success && resultData.images && Array.isArray(resultData.images)) {
      // Update template with generated images
      await updateTemplateWithImages(injectedTemplateId, resultData.images)

      // Update job status to completed
      await query(`
        UPDATE image_generation_jobs 
        SET status = 'completed', 
            completed_at = NOW(),
            result_images = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify(resultData.images), localJobId])

      logger.info(`Successfully updated template ${injectedTemplateId} with ${resultData.images.length} images`)

    } else {
      throw new Error('No valid images returned from result endpoint')
    }

  } catch (error) {
    logger.error(`Error handling completed job ${externalJobId}:`, error)
    await handleJobFailed(localJobId, externalJobId, `Failed to process results: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function handleJobFailed(localJobId: string, externalJobId: string, errorMessage: string) {
  try {
    logger.error(`Image job failed: ${externalJobId}, error: ${errorMessage}`)

    await query(`
      UPDATE image_generation_jobs 
      SET status = 'failed', 
          error_message = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [errorMessage, localJobId])

  } catch (error) {
    logger.error(`Error updating failed job ${externalJobId}:`, error)
  }
}

async function updateJobStatus(localJobId: string, status: string) {
  try {
    await query(`
      UPDATE image_generation_jobs 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `, [status, localJobId])
  } catch (error) {
    logger.error(`Error updating job status for ${localJobId}:`, error)
  }
}

async function updateTemplateWithImages(injectedTemplateId: string, images: Array<{ role: string; index?: number; url: string }>) {
  try {
    // Import the image replacement utility
    const { replaceTemplateImagesInHTML } = await import('@/lib/utils/template-image-replacer')
    
    // Get current template HTML
    const templateResult = await query(`
      SELECT html_content, template_id 
      FROM injected_templates 
      WHERE id = $1
    `, [injectedTemplateId])

    if (templateResult.rows.length === 0) {
      throw new Error(`Template not found: ${injectedTemplateId}`)
    }

    const template = templateResult.rows[0]
    const currentHtml = template.html_content || ''
    const templateId = template.template_id

    // Replace images in HTML
    const updatedHtml = replaceTemplateImagesInHTML(currentHtml, images, templateId)

    // Update template in database
    await query(`
      UPDATE injected_templates 
      SET html_content = $1
      WHERE id = $2
    `, [updatedHtml, injectedTemplateId])

    logger.info(`Updated template ${injectedTemplateId} with ${images.length} new images`)

  } catch (error) {
    logger.error(`Error updating template ${injectedTemplateId} with images:`, error)
    throw error
  }
}

// Public method to manually add a job to track
export async function trackImageJob(jobData: {
  external_job_id: string
  injected_template_id: string
  user_id: string
  prompts: any
}) {
  try {
    const result = await query(`
      INSERT INTO image_generation_jobs (external_job_id, injected_template_id, user_id, prompts)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [
      jobData.external_job_id,
      jobData.injected_template_id,
      jobData.user_id,
      JSON.stringify(jobData.prompts)
    ])

    const localJobId = result.rows[0].id
    logger.info(`Started tracking image job: external=${jobData.external_job_id}, local=${localJobId}`)
    
    return localJobId

  } catch (error) {
    logger.error('Error tracking image job:', error)
    throw error
  }
}
