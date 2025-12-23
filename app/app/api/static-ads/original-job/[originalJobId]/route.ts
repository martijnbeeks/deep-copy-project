import { NextRequest, NextResponse } from 'next/server'
import { 
  getStaticAdJobsByOriginalJob,
  getGeneratedStaticAdsByOriginalJob,
  getStaticAdJob,
  updateStaticAdJobStatus,
  getGeneratedStaticAds
} from '@/lib/db/queries'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { logger } from '@/lib/utils/logger'
import { getDeepCopyAccessToken } from '@/lib/auth/deepcopy-auth'

const STATIC_ADS_API_URL = process.env.STATIC_ADS_API_URL

export async function GET(
  request: NextRequest,
  { params }: { params: { originalJobId: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    const originalJobId = params.originalJobId

    if (!originalJobId) {
      return createValidationErrorResponse('originalJobId is required')
    }

    // Get all static ad jobs for this original job
    const staticAdJobs = await getStaticAdJobsByOriginalJob(originalJobId)

    // For jobs that are pending or processing, check their actual status from external API
    // This ensures we catch jobs that are actually completed but still marked as pending
    const updatedJobs = await Promise.all(
      staticAdJobs.map(async (job) => {
        // Only check status for pending/processing jobs
        const normalizedStatus = (job.status || "").toLowerCase();
        if (normalizedStatus === "pending" || normalizedStatus === "processing") {
          try {
            if (STATIC_ADS_API_URL && job.external_job_id) {
              // Get OAuth2 access token
              let accessToken: string
              try {
                logger.log(`🔐 [OriginalJob] Requesting OAuth2 token for job ${job.id}...`)
                accessToken = await getDeepCopyAccessToken()
              } catch (authError: any) {
                logger.error(`❌ [OriginalJob] Failed to get OAuth2 token for job ${job.id}: ${authError.message}`)
                // Continue without updating status if auth fails
                return job
              }
              
              const apiEndpoint = `${STATIC_ADS_API_URL}/image-gen/${job.external_job_id}`
              logger.log(`🌐 [OriginalJob] Polling external API for job ${job.id}: ${apiEndpoint}`)
              
              const response = await fetch(apiEndpoint, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(1200000) // 20 minutes timeout to match status route
              })
              
              logger.log(`📡 [OriginalJob] Response status for job ${job.id}: ${response.status} ${response.statusText}`)

              if (response.ok) {
                const externalData = await response.json()
                logger.log(`📥 [OriginalJob] Response data for job ${job.id}: status=${externalData.status}, progress=${externalData.progress}`)
                
                // Normalize status (case-insensitive)
                const normalizeStatus = (status: string): string => {
                  if (!status) return 'pending'
                  const lower = status.toLowerCase()
                  if (lower === 'completed' || lower === 'succeeded' || lower === 'complete') return 'completed'
                  if (lower === 'failed' || lower === 'failure' || lower === 'error') return 'failed'
                  if (lower === 'processing' || lower === 'running' || lower === 'in_progress') return 'processing'
                  return lower
                }

                const normalizedStatus = normalizeStatus(externalData.status)
                
                // If job is completed/succeeded, fetch from result endpoint to get actual images
                let resultData = externalData.result || {}
                let generatedImages = resultData.generatedImages || []
                
                if (normalizedStatus === 'completed' && generatedImages.length === 0) {
                  logger.log(`📥 [OriginalJob] Job ${job.id} completed but no images in status response. Fetching from result endpoint...`)
                  try {
                    const resultEndpoint = `${STATIC_ADS_API_URL}/image-gen/${job.external_job_id}/result`
                    const resultResponse = await fetch(resultEndpoint, {
                      method: 'GET',
                      headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                      },
                      signal: AbortSignal.timeout(1200000)
                    })
                    
                    if (resultResponse.ok) {
                      const resultResponseData = await resultResponse.json()
                      resultData = resultResponseData.result || resultResponseData || {}
                      generatedImages = resultData.generatedImages || resultResponseData.generatedImages || []
                      if (resultResponseData.metadata) {
                        resultData.metadata = { ...resultData.metadata, ...resultResponseData.metadata }
                      }
                      logger.log(`📥 [OriginalJob] Fetched ${generatedImages.length} images from result endpoint for job ${job.id}`)
                    }
                  } catch (resultError: any) {
                    logger.warn(`⚠️ [OriginalJob] Failed to fetch result endpoint for job ${job.id}: ${resultError.message}`)
                  }
                }
                
                const successfulExternalImages = generatedImages.filter((img: any) => img.success === true)
                
                // Get stored images for this job
                const storedAds = await getGeneratedStaticAds(job.id)
                const completedImages = storedAds.filter(ad => ad.status === 'completed')
                
                // Calculate expected image count from metadata or unique angles
                let expectedImageCount = 0
                const metadata = resultData.metadata || externalData.metadata || {}
                
                if (metadata.selectedAnglesCount) {
                  expectedImageCount = metadata.selectedAnglesCount * 2
                } else if (metadata.variationsGenerated) {
                  expectedImageCount = metadata.variationsGenerated
                } else {
                  const uniqueAngles = new Set(successfulExternalImages.map((img: any) => img.angleIndex || 1))
                  expectedImageCount = uniqueAngles.size * 2
                }
                
                // Only mark as completed if:
                // 1. External API explicitly says completed, OR
                // 2. We have all expected images AND external API status is not "pending"
                const externalSaysCompleted = normalizeStatus(externalData.status) === 'completed'
                const hasAllExpectedImages = expectedImageCount > 0 && 
                                             completedImages.length >= expectedImageCount &&
                                             normalizeStatus(externalData.status) !== 'pending'
                
                // If external API says completed, or we have all expected images, mark as completed
                if (externalSaysCompleted || hasAllExpectedImages) {
                  await updateStaticAdJobStatus(
                    job.id,
                    'completed',
                    100,
                    externalData.error || null
                  )
                  logger.log(`✅ Updated job ${job.id} status to completed when loading previous images`)
                  return {
                    ...job,
                    status: 'completed',
                    progress: 100
                  }
                } else {
                  // Update with current external status
                  const finalStatus = normalizeStatus(externalData.status || job.status)
                  await updateStaticAdJobStatus(
                    job.id,
                    finalStatus,
                    externalData.progress || job.progress,
                    externalData.error || null
                  )
                  return {
                    ...job,
                    status: finalStatus,
                    progress: externalData.progress || job.progress
                  }
                }
              }
            } else {
              const errorText = await response.text()
              logger.error(`❌ [OriginalJob] External API error for job ${job.id}: ${response.status} ${response.statusText}`)
              logger.error(`❌ [OriginalJob] Error response: ${errorText}`)
            }
          } catch (error: any) {
            // If status check fails, just return the job as-is
            logger.error(`❌ [OriginalJob] Error checking status for job ${job.id}: ${error.message || error}`)
          }
        }
        return job
      })
    )

    // Get all generated images for this original job
    const generatedImages = await getGeneratedStaticAdsByOriginalJob(originalJobId)

    return createSuccessResponse({
      jobs: updatedJobs.map(job => ({
        id: job.id,
        externalJobId: job.external_job_id,
        status: job.status,
        progress: job.progress,
        errorMessage: job.error_message,
        selectedAngles: job.selected_angles ? JSON.parse(job.selected_angles) : null,
        createdAt: job.created_at,
        updatedAt: job.updated_at
      })),
      generatedImages: generatedImages.map(img => ({
        id: img.id,
        staticAdJobId: img.static_ad_job_id,
        imageUrl: img.image_url,
        angleIndex: img.angle_index,
        variationNumber: img.variation_number,
        angleName: img.angle_name,
        status: img.status,
        createdAt: img.created_at
      })) as any // Type assertion needed since we're adding staticAdJobId
    })
  } catch (error) {
    return handleApiError(error)
  }
}

