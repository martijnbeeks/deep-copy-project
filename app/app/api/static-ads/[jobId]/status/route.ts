import { NextRequest, NextResponse } from 'next/server'
import { 
  getStaticAdJob, 
  updateStaticAdJobStatus,
  createGeneratedStaticAd,
  updateGeneratedStaticAdStatus,
  getGeneratedStaticAds,
  getJobById
} from '@/lib/db/queries'
import { query } from '@/lib/db/connection'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { incrementOrganizationUsage } from '@/lib/db/queries'
import { getUserOrganization } from '@/lib/middleware/usage-limits'
import { logger } from '@/lib/utils/logger'

const STATIC_ADS_API_URL = process.env.STATIC_ADS_API_URL

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    if (!STATIC_ADS_API_URL) {
      return NextResponse.json(
        { error: 'Static ads API URL not configured' },
        { status: 500 }
      )
    }

    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    const jobId = params.jobId

    // Get static ad job from database
    const staticAdJob = await getStaticAdJob(jobId)
    if (!staticAdJob) {
      return createValidationErrorResponse('Static ad job not found', 404)
    }

    // Verify user owns this job
    if (staticAdJob.user_id !== authResult.user.id) {
      return createValidationErrorResponse('Unauthorized', 403)
    }

    // Poll external API for status
    try {
      // Use AbortSignal.timeout for proper timeout handling
      // This handles both headers timeout and body timeout
      const response = await fetch(`${STATIC_ADS_API_URL}/job/${staticAdJob.external_job_id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        // Long timeout for polling (20 minutes = 1200000ms)
        signal: AbortSignal.timeout(1200000) // 20 minutes for polling
      })

      if (!response.ok) {
        logger.error(`❌ External API error: ${response.status}`)
        // Return current database status if API fails
        const existingAds = await getGeneratedStaticAds(jobId)
        return createSuccessResponse({
          jobId: staticAdJob.id,
          externalJobId: staticAdJob.external_job_id,
          status: staticAdJob.status,
          progress: staticAdJob.progress,
          error: staticAdJob.error_message,
          generatedImages: existingAds.map(ad => ({
            imageUrl: ad.image_url,
            angleIndex: ad.angle_index,
            variationNumber: ad.variation_number,
            angleName: ad.angle_name,
            status: ad.status
          })),
          apiError: `External API returned ${response.status}`
        })
      }

      const externalData = await response.json()

      // Normalize status (case-insensitive)
      const normalizeStatus = (status: string): string => {
        if (!status) return 'pending'
        const lower = status.toLowerCase()
        if (lower === 'completed' || lower === 'succeeded' || lower === 'complete') return 'completed'
        if (lower === 'failed' || lower === 'failure' || lower === 'error') return 'failed'
        if (lower === 'processing' || lower === 'running' || lower === 'in_progress') return 'processing'
        return lower // Return normalized lowercase
      }

      // Process generated images from external API
      const result = externalData.result || {}
      const generatedImages = result.generatedImages || []

      // Track which images we've already stored
      const existingAds = await getGeneratedStaticAds(jobId)
      const existingImageUrls = new Set(existingAds.map(ad => ad.image_url))

      // Get user's organization for credit tracking
      const organizationId = await getUserOrganization(authResult.user)

      // Map external API's angleIndex (1-based for selected angles) to actual marketing angle index
      // External API returns angleIndex as 1, 2, 3... based on selected order
      // We need to map this to the actual marketing angle index (1, 2, 3, 4... in the marketing angles array)
      let angleIndexMap: Map<number, number> = new Map()
      
      try {
        // Get selected angles from job
        const selectedAnglesJson = staticAdJob.selected_angles
        if (selectedAnglesJson) {
          const selectedAngles: string[] = JSON.parse(selectedAnglesJson)
          
          // Get marketing angles from original job
          const resultQuery = await query(
            `SELECT metadata FROM results WHERE job_id = $1`,
            [staticAdJob.original_job_id]
          )
          
          if (resultQuery.rows.length > 0) {
            const metadata = resultQuery.rows[0].metadata
            const fullResult = metadata?.full_result || metadata
            const marketingAngles = fullResult?.results?.marketing_angles || []
            
            // Helper to parse angle string (handles both "Title: Description" and plain description)
            const parseAngleString = (angleStr: string): string => {
              if (angleStr.includes(':')) {
                return angleStr.split(':').slice(1).join(':').trim()
              }
              return angleStr.trim()
            }
            
            // Helper to get angle string from marketing angle (handles both string and object formats)
            const getMarketingAngleString = (ma: any): string => {
              if (typeof ma === 'string') return parseAngleString(ma)
              if (ma.angle) return parseAngleString(ma.angle)
              if (ma.title && ma.angle) return parseAngleString(`${ma.title}: ${ma.angle}`)
              return ''
            }
            
            // Build mapping: external angleIndex (1-based for selected) → actual marketing angle index (1-based)
            selectedAngles.forEach((selectedAngleStr, selectedIndex) => {
              const externalAngleIndex = selectedIndex + 1 // External API uses 1-based index
              
              // Find the actual marketing angle index
              const actualIndex = marketingAngles.findIndex((ma: any) => {
                const marketingAngleStr = getMarketingAngleString(ma)
                const normalizedSelected = parseAngleString(selectedAngleStr).toLowerCase().trim()
                const normalizedMarketing = marketingAngleStr.toLowerCase().trim()
                
                // Try exact match first
                if (normalizedSelected === normalizedMarketing) return true
                
                // Try partial match (selected contains marketing or vice versa)
                if (normalizedSelected.includes(normalizedMarketing) || normalizedMarketing.includes(normalizedSelected)) {
                  return true
                }
                
                // Also check if it's the full format "Title: Description"
                const fullSelected = selectedAngleStr.toLowerCase().trim()
                if (fullSelected === marketingAngleStr.toLowerCase().trim()) return true
                
                return false
              })
              
              if (actualIndex >= 0) {
                const actualMarketingAngleIndex = actualIndex + 1 // 1-based index
                angleIndexMap.set(externalAngleIndex, actualMarketingAngleIndex)
                logger.log(`📊 Angle mapping: external ${externalAngleIndex} → actual ${actualMarketingAngleIndex} (${selectedAngleStr})`)
              } else {
                // Fallback: use external index if we can't find a match
                logger.warn(`⚠️ Could not map external angleIndex ${externalAngleIndex} for "${selectedAngleStr}", using external index`)
                angleIndexMap.set(externalAngleIndex, externalAngleIndex)
              }
            })
          }
        }
      } catch (error) {
        logger.error(`❌ Error mapping angle indices: ${error}`)
        // Continue with default behavior (use external angleIndex as-is)
      }

      // Store new images as they arrive
      for (const image of generatedImages) {
        if (image.success && image.imageUrl) {
          // Skip if we already have this image
          if (existingImageUrls.has(image.imageUrl)) {
            continue
          }

          // Map external angleIndex to actual marketing angle index
          const externalAngleIndex = image.angleIndex || 1
          const actualAngleIndex = angleIndexMap.get(externalAngleIndex) || externalAngleIndex

          // Store new image (function will check for duplicates internally)
          const { record: storedAd, isNew } = await createGeneratedStaticAd({
            static_ad_job_id: jobId,
            original_job_id: staticAdJob.original_job_id,
            image_url: image.imageUrl,
            angle_index: actualAngleIndex,
            variation_number: image.variationNumber || 1,
            angle_name: image.adType || image.name || `Angle ${actualAngleIndex}`,
            status: 'completed'
          })

          // Add to existingImageUrls Set immediately to prevent duplicates in same batch
          existingImageUrls.add(image.imageUrl)

          // Only process if a new image was actually stored (not a duplicate)
          if (isNew && storedAd) {
            logger.log(`✅ Stored new static ad image: ${image.imageUrl}`)
            
            // Increment credit usage for this new image (per-image billing)
            if (organizationId) {
              try {
                await incrementOrganizationUsage(organizationId, 'static_ads')
                logger.log(`💰 Incremented credit usage for new image: ${image.imageUrl}`)
              } catch (creditError: any) {
                // Log but don't fail the request if credit increment fails
                logger.error(`⚠️ Failed to increment credit usage: ${creditError.message}`)
              }
            }
          } else {
            logger.log(`⏭️ Skipped duplicate image: ${image.imageUrl}`)
          }
        }
      }

      // Get all stored images (including newly added ones)
      const allStoredAds = await getGeneratedStaticAds(jobId)
      
      // Count successful images from external API response
      const successfulExternalImages = generatedImages.filter((img: any) => img.success === true)
      const completedImages = allStoredAds.filter(ad => ad.status === 'completed')
      
      // Calculate expected image count from metadata or unique angles
      // External API generates 2 images per angle
      let expectedImageCount = 0
      const metadata = result.metadata || externalData.metadata || {}
      
      if (metadata.selectedAnglesCount) {
        // Use metadata if available
        expectedImageCount = metadata.selectedAnglesCount * 2
      } else if (metadata.variationsGenerated) {
        // Use variationsGenerated if available
        expectedImageCount = metadata.variationsGenerated
      } else {
        // Calculate from unique angles in generated images
        const uniqueAngles = new Set(successfulExternalImages.map((img: any) => img.angleIndex || 1))
        expectedImageCount = uniqueAngles.size * 2
      }
      
      // Only mark as completed if:
      // 1. External API explicitly says completed, OR
      // 2. We have all expected images (expectedImageCount) AND external API status is not "pending"
      const externalSaysCompleted = normalizeStatus(externalData.status) === 'completed'
      const hasAllExpectedImages = expectedImageCount > 0 && 
                                   completedImages.length >= expectedImageCount &&
                                   normalizeStatus(externalData.status) !== 'pending'
      
      logger.log(`📊 Job ${jobId} status check: external=${externalData.status}, expected=${expectedImageCount}, stored=${completedImages.length}, externalImages=${successfulExternalImages.length}`)

      // Determine final status
      let finalStatus = normalizeStatus(externalData.status || staticAdJob.status)
      const progress = externalData.progress || staticAdJob.progress || 0
      const currentStep = externalData.currentStep || ''
      const errorMessage = externalData.error || null

      // If external API says completed, or we have all expected images, mark as completed
      // Only update status if it's not already completed (prevent duplicate updates)
      if (externalSaysCompleted || hasAllExpectedImages) {
        finalStatus = 'completed'
        // Only update if job is not already completed (prevent duplicate status updates)
        if (staticAdJob.status !== 'completed') {
          // If we have all images but external API doesn't say completed, set progress to 100
          const finalProgress = 100
          await updateStaticAdJobStatus(
            jobId,
            'completed',
            finalProgress,
            errorMessage
          )
          logger.log(`✅ Static ad job ${jobId} marked as completed (${completedImages.length}/${expectedImageCount} expected images stored, external status: ${externalData.status})`)
        } else {
          logger.log(`ℹ️ Job ${jobId} already marked as completed, skipping status update`)
        }
      } else {
        // Update with external API status (only if status changed)
        if (staticAdJob.status !== finalStatus || staticAdJob.progress !== progress) {
          await updateStaticAdJobStatus(
            jobId,
            finalStatus,
            progress,
            errorMessage
          )
        }
      }

      // Get updated job status from database (after potential update)
      const updatedJob = await getStaticAdJob(jobId)
      const currentStatus = updatedJob?.status || finalStatus
      const currentProgress = updatedJob?.progress || progress

      // Return status with all images
      return createSuccessResponse({
        jobId: staticAdJob.id,
        externalJobId: staticAdJob.external_job_id,
        status: currentStatus,
        progress: currentProgress,
        currentStep: currentStep,
        error: errorMessage,
        generatedImages: allStoredAds.map(ad => ({
          id: ad.id,
          imageUrl: ad.image_url,
          angleIndex: ad.angle_index,
          variationNumber: ad.variation_number,
          angleName: ad.angle_name,
          status: ad.status,
          createdAt: ad.created_at
        })),
        // Also include raw external API data for debugging
        externalData: {
          status: externalData.status,
          progress: externalData.progress,
          currentStep: externalData.currentStep
        },
        // Include completion check info
        completionInfo: {
          expectedImages: expectedImageCount,
          externalImages: successfulExternalImages.length,
          storedImages: completedImages.length,
          hasAllExpectedImages: hasAllExpectedImages,
          externalSaysCompleted: externalSaysCompleted
        }
      })
    } catch (error: any) {
      // Handle timeout errors gracefully - don't log as error if it's just a timeout
      if (error.name === 'AbortError' || error.code === 'UND_ERR_HEADERS_TIMEOUT' || error.message?.includes('timeout')) {
        logger.warn(`⏱️ Polling timeout for job ${jobId} (this is normal for long-running jobs): ${error.message || 'Timeout'}`)
      } else {
        logger.error('❌ Error polling external API:', error)
      }
      
      // Return current database status on error (including timeout)
      const existingAds = await getGeneratedStaticAds(jobId)
      return createSuccessResponse({
        jobId: staticAdJob.id,
        externalJobId: staticAdJob.external_job_id,
        status: staticAdJob.status,
        progress: staticAdJob.progress,
        error: staticAdJob.error_message,
        generatedImages: existingAds.map(ad => ({
          id: ad.id,
          imageUrl: ad.image_url,
          angleIndex: ad.angle_index,
          variationNumber: ad.variation_number,
          angleName: ad.angle_name,
          status: ad.status,
          createdAt: ad.created_at
        })),
        apiError: error.message || 'Failed to poll external API'
      })
    }
  } catch (error) {
    return handleApiError(error)
  }
}

