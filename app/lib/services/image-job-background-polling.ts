import { query } from '@/lib/db/connection'
import { logger } from '@/lib/utils/logger'

// Global polling manager for image generation jobs
const imageJobPollingManager = new Map<string, NodeJS.Timeout>()

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

export class ImageJobBackgroundPollingService {
  private static instance: ImageJobBackgroundPollingService
  private isRunning = false
  private pollInterval: NodeJS.Timeout | null = null

  static getInstance(): ImageJobBackgroundPollingService {
    if (!ImageJobBackgroundPollingService.instance) {
      ImageJobBackgroundPollingService.instance = new ImageJobBackgroundPollingService()
    }
    return ImageJobBackgroundPollingService.instance
  }

  start() {
    if (this.isRunning) {
      logger.info('Image job background polling already running')
      return
    }

    this.isRunning = true
    logger.info('Starting image job background polling service')

    // Check for jobs every 30 seconds
    this.pollInterval = setInterval(() => {
      this.checkAllImageJobs()
    }, 30000)

    // Initial check
    this.checkAllImageJobs()
  }

  stop() {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    logger.info('Stopping image job background polling service')

    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    // Stop all individual job polling
    imageJobPollingManager.forEach((timeoutId, jobId) => {
      clearTimeout(timeoutId)
    })
    imageJobPollingManager.clear()
  }

  private async checkAllImageJobs() {
    try {
      // Get all image generation jobs that are not completed/failed
      const result = await query(`
        SELECT id, external_job_id, injected_template_id, user_id, status, updated_at
        FROM image_generation_jobs 
        WHERE status IN ('pending', 'processing')
        ORDER BY updated_at DESC
      `)

      const jobsToPoll = result.rows

      logger.info(`Found ${jobsToPoll.length} image jobs to poll`)

      for (const job of jobsToPoll) {
        // Only start polling if not already polling
        if (!imageJobPollingManager.has(job.id)) {
          this.startImageJobPolling(job.id, job.external_job_id, job.injected_template_id)
        }
      }

    } catch (error) {
      logger.error('Error checking image generation jobs:', error)
    }
  }

  private startImageJobPolling(localJobId: string, externalJobId: string, injectedTemplateId: string) {
    let pollCount = 0
    const maxPolls = 180 // Maximum 1 hour of polling (180 * 20 seconds)

    const poll = async () => {
      try {
        pollCount++
        logger.debug(`Polling image job ${externalJobId}, attempt ${pollCount}/${maxPolls}`)

        // Check job status via backend API
        const statusResponse = await fetch(`${process.env.BACKEND_API_URL || 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/'}prelander-images/${externalJobId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            // Note: We'll need auth token here - for now using public endpoint
          }
        })

        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()

        if (statusData.status === 'COMPLETED_PRELANDER_IMAGE_GEN') {
          // Job completed - get results and store them
          await this.handleJobCompleted(localJobId, externalJobId, injectedTemplateId)
          return

        } else if (statusData.status === 'FAILED_PRELANDER_IMAGE_GEN') {
          // Job failed
          await this.handleJobFailed(localJobId, externalJobId, statusData.error || 'Unknown error')
          return

        } else if (['RUNNING_PRELANDER_IMAGE_GEN', 'SUBMITTED', 'PENDING'].includes(statusData.status)) {
          // Job still processing - update status and continue
          const newStatus = statusData.status === 'SUBMITTED' ? 'pending' : 'processing'
          await this.updateJobStatus(localJobId, newStatus)

          // Continue polling if we haven't reached max polls
          if (pollCount < maxPolls) {
            const timeoutId = setTimeout(poll, 20000) // Poll every 20 seconds
            imageJobPollingManager.set(localJobId, timeoutId)
          } else {
            logger.warn(`Image job ${externalJobId} exceeded max polls, marking as failed`)
            await this.handleJobFailed(localJobId, externalJobId, 'Job timed out after 1 hour')
          }
        } else {
          // Unknown status - mark as failed
          logger.warn(`Unknown status for image job ${externalJobId}: ${statusData.status}`)
          await this.handleJobFailed(localJobId, externalJobId, `Unknown status: ${statusData.status}`)
        }

      } catch (error) {
        logger.error(`Error polling image job ${externalJobId}:`, error)
        
        // Continue polling for network errors, but mark as failed after too many
        if (pollCount >= 5) {
          await this.handleJobFailed(localJobId, externalJobId, `Polling error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } else {
          // Retry after delay
          const timeoutId = setTimeout(poll, 30000) // Wait longer on error
          imageJobPollingManager.set(localJobId, timeoutId)
        }
      }
    }

    // Start polling after a short delay
    const timeoutId = setTimeout(poll, 5000) // Start after 5 seconds
    imageJobPollingManager.set(localJobId, timeoutId)
  }

  private async handleJobCompleted(localJobId: string, externalJobId: string, injectedTemplateId: string) {
    try {
      logger.info(`Image job completed: ${externalJobId}`)

      // Get results from backend API
      const resultResponse = await fetch(`${process.env.BACKEND_API_URL || 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/'}prelander-images/${externalJobId}/result?creditType=templates_images`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!resultResponse.ok) {
        throw new Error(`Result fetch failed: ${resultResponse.status}`)
      }

      const resultData = await resultResponse.json()

      if (resultData.success && resultData.images && Array.isArray(resultData.images)) {
        // Update template with generated images
        await this.updateTemplateWithImages(injectedTemplateId, resultData.images)

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
      await this.handleJobFailed(localJobId, externalJobId, `Failed to process results: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      // Stop polling
      imageJobPollingManager.delete(localJobId)
    }
  }

  private async handleJobFailed(localJobId: string, externalJobId: string, errorMessage: string) {
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
    } finally {
      // Stop polling
      imageJobPollingManager.delete(localJobId)
    }
  }

  private async updateJobStatus(localJobId: string, status: string) {
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

  private async updateTemplateWithImages(injectedTemplateId: string, images: Array<{ role: string; index?: number; url: string }>) {
    try {
      // Import the image replacement utility
      const { replaceTemplateImagesInHTML } = await import('@/lib/utils/template-image-replacer')
      
      // Get current template HTML
      const templateResult = await query(`
        SELECT html, html_content, template_id 
        FROM injected_templates 
        WHERE id = $1
      `, [injectedTemplateId])

      if (templateResult.rows.length === 0) {
        throw new Error(`Template not found: ${injectedTemplateId}`)
      }

      const template = templateResult.rows[0]
      const currentHtml = template.html || template.html_content || ''
      const templateId = template.template_id

      // Replace images in HTML
      const updatedHtml = replaceTemplateImagesInHTML(currentHtml, images, templateId)

      // Update template in database
      await query(`
        UPDATE injected_templates 
        SET html = $1, updated_at = NOW()
        WHERE id = $2
      `, [updatedHtml, injectedTemplateId])

      logger.info(`Updated template ${injectedTemplateId} with ${images.length} new images`)

    } catch (error) {
      logger.error(`Error updating template ${injectedTemplateId} with images:`, error)
      throw error
    }
  }

  // Public method to manually add a job to track
  async trackJob(jobData: {
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

  // Get status of all tracked jobs
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(imageJobPollingManager.keys()),
      activeJobCount: imageJobPollingManager.size
    }
  }

  // Get job history for a user
  async getUserJobHistory(userId: string, limit = 10) {
    try {
      const result = await query(`
        SELECT * FROM image_generation_jobs 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `, [userId, limit])

      return result.rows

    } catch (error) {
      logger.error('Error getting user job history:', error)
      return []
    }
  }
}

// Export singleton instance
export const imageJobBackgroundPollingService = ImageJobBackgroundPollingService.getInstance()
