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
              const response = await fetch(`${STATIC_ADS_API_URL}/job/${job.external_job_id}`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(1200000) // 20 minutes timeout to match status route
              })

              if (response.ok) {
                const externalData = await response.json()
                
                // Normalize status (case-insensitive)
                const normalizeStatus = (status: string): string => {
                  if (!status) return 'pending'
                  const lower = status.toLowerCase()
                  if (lower === 'completed' || lower === 'succeeded' || lower === 'complete') return 'completed'
                  if (lower === 'failed' || lower === 'failure' || lower === 'error') return 'failed'
                  if (lower === 'processing' || lower === 'running' || lower === 'in_progress') return 'processing'
                  return lower
                }

                const result = externalData.result || {}
                const generatedImages = result.generatedImages || []
                const successfulExternalImages = generatedImages.filter((img: any) => img.success === true)
                
                // Get stored images for this job
                const storedAds = await getGeneratedStaticAds(job.id)
                const completedImages = storedAds.filter(ad => ad.status === 'completed')
                
                // Calculate expected image count from metadata or unique angles
                let expectedImageCount = 0
                const metadata = result.metadata || externalData.metadata || {}
                
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
            }
          } catch (error) {
            // If status check fails, just return the job as-is
            logger.error(`Error checking status for job ${job.id}:`, error)
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

