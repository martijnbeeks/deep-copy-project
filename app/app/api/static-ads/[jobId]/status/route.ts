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
import { getUserOrganization, checkUsageLimit } from '@/lib/middleware/usage-limits'
import { logger } from '@/lib/utils/logger'
import { getDeepCopyAccessToken } from '@/lib/auth/deepcopy-auth'

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
      // Get OAuth2 access token
      let accessToken: string
      try {
        logger.log(`🔐 [Status] Requesting OAuth2 access token for job ${jobId}...`)
        accessToken = await getDeepCopyAccessToken()
        logger.log(`✅ [Status] OAuth2 token acquired`)
      } catch (authError: any) {
        logger.error(`❌ [Status] Failed to get OAuth2 token: ${authError.message}`)
        throw new Error(`Authentication failed: ${authError.message}`)
      }
      
      const apiEndpoint = `${STATIC_ADS_API_URL}/image-gen/${staticAdJob.external_job_id}`
      logger.log(`🌐 [Status] Polling external API: ${apiEndpoint}`)
      logger.log(`📋 [Status] External job ID: ${staticAdJob.external_job_id}`)
      
      // Use AbortSignal.timeout for proper timeout handling
      // This handles both headers timeout and body timeout
      const response = await fetch(apiEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        // Long timeout for polling (20 minutes = 1200000ms)
        signal: AbortSignal.timeout(1200000) // 20 minutes for polling
      })
      
      logger.log(`📡 [Status] Response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(`❌ [Status] External API error: ${response.status} ${response.statusText}`)
        logger.error(`❌ [Status] Error response body: ${errorText}`)
        logger.error(`❌ [Status] Request URL: ${apiEndpoint}`)
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
          apiError: `External API returned ${response.status}: ${errorText}`
        })
      }

      const externalData = await response.json()
      
      // Log full response including error when status is FAILED
      if (externalData.status === 'FAILED' || externalData.status === 'failed') {
        logger.error(`❌ [Status] Job FAILED - Full response: ${JSON.stringify(externalData, null, 2)}`)
        logger.error(`❌ [Status] Error message: ${externalData.error || externalData.message || externalData.errorMessage || 'No error message provided'}`)
        if (externalData.errorDetails) {
          logger.error(`❌ [Status] Error details: ${JSON.stringify(externalData.errorDetails, null, 2)}`)
        }
      } else {
        logger.log(`📥 [Status] Response data: ${JSON.stringify({ status: externalData.status, progress: externalData.progress, imagesCount: externalData.result?.generatedImages?.length || 0 }, null, 2)}`)
      }

      // Normalize status (case-insensitive)
      const normalizeStatus = (status: string): string => {
        if (!status) return 'pending'
        const lower = status.toLowerCase()
        if (lower === 'completed' || lower === 'succeeded' || lower === 'complete') return 'completed'
        if (lower === 'failed' || lower === 'failure' || lower === 'error') return 'failed'
        if (lower === 'processing' || lower === 'running' || lower === 'in_progress') return 'processing'
        return lower // Return normalized lowercase
      }

      const normalizedStatus = normalizeStatus(externalData.status)
      
      // If job is failed, fetch from result endpoint to get error details
      if (normalizedStatus === 'failed') {
        logger.log(`📥 [Status] Job failed. Fetching from result endpoint for error details...`)
        try {
          const resultEndpoint = `${STATIC_ADS_API_URL}/image-gen/${staticAdJob.external_job_id}/result`
          logger.log(`🌐 [Status] Fetching results from: ${resultEndpoint}`)
          
          const resultResponse = await fetch(resultEndpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(1200000) // 20 minutes
          })
          
          if (resultResponse.ok) {
            const resultResponseData = await resultResponse.json()
            logger.error(`📥 [Status] Result endpoint response for FAILED job: ${JSON.stringify(resultResponseData, null, 2)}`)
            // The error details might be in the result endpoint
            if (resultResponseData.error || resultResponseData.message) {
              logger.error(`❌ [Status] Backend error details: ${resultResponseData.error || resultResponseData.message}`)
            }
            // Update externalData with error from result endpoint if available
            if (resultResponseData.error && !externalData.error) {
              externalData.error = resultResponseData.error
            }
          } else {
            const errorText = await resultResponse.text()
            logger.warn(`⚠️ [Status] Result endpoint returned ${resultResponse.status} for failed job: ${errorText}`)
          }
        } catch (resultError: any) {
          logger.warn(`⚠️ [Status] Failed to fetch result endpoint for failed job: ${resultError.message}`)
        }
      }
      
      // If job is completed/succeeded, fetch from result endpoint to get actual images
      // The status endpoint might not include images, but the result endpoint does
      let resultData = externalData.result || {}
      let generatedImages = resultData.generatedImages || []
      
      if (normalizedStatus === 'completed' && generatedImages.length === 0) {
        logger.log(`📥 [Status] Job completed but no images in status response. Fetching from result endpoint...`)
        try {
          const resultEndpoint = `${STATIC_ADS_API_URL}/image-gen/${staticAdJob.external_job_id}/result`
          logger.log(`🌐 [Status] Fetching results from: ${resultEndpoint}`)
          
          const resultResponse = await fetch(resultEndpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(1200000) // 20 minutes
          })
          
          if (resultResponse.ok) {
            const resultResponseData = await resultResponse.json()
            
            // Log the FULL response structure to understand what we're getting
            logger.log(`📥 [Status] Result endpoint FULL response: ${JSON.stringify(resultResponseData, null, 2)}`)
            
            // Try multiple possible response structures
            // Structure 1: resultResponseData.generatedImages
            // Structure 2: resultResponseData.result.generatedImages
            // Structure 3: resultResponseData.analysisResults?.generatedImages
            // Structure 4: resultResponseData.data?.generatedImages
            generatedImages = 
              resultResponseData.generatedImages || 
              resultResponseData.result?.generatedImages || 
              resultResponseData.analysisResults?.generatedImages ||
              resultResponseData.data?.generatedImages ||
              []
            
            logger.log(`📊 [Status] Found ${generatedImages.length} images in result endpoint`)
            
            // Update resultData with the full response structure
            resultData = resultResponseData.result || resultResponseData || {}
            if (generatedImages.length > 0) {
              resultData.generatedImages = generatedImages
            }
            
            // Also merge any metadata from result endpoint
            if (resultResponseData.metadata) {
              resultData.metadata = { ...resultData.metadata, ...resultResponseData.metadata }
            }
          } else {
            const errorText = await resultResponse.text()
            logger.warn(`⚠️ [Status] Result endpoint returned ${resultResponse.status}: ${errorText}`)
          }
        } catch (resultError: any) {
          logger.warn(`⚠️ [Status] Failed to fetch from result endpoint: ${resultError.message}`)
          // Continue with status endpoint data
        }
      }
      
      // Process generated images from external API
      logger.log(`📊 [Status] Processing ${generatedImages.length} generated images`)

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
        // Handle different backend response structures:
        // Structure 1: { status: "success", cloudflare: { variants: [...] }, angle_num, variation_num }
        // Structure 2: { success: true, imageUrl, angleIndex, variationNumber }
        const imageStatus = image.status || (image.success === true ? 'success' : null)
        const imageUrl = 
          image.cloudflare?.variants?.[0] || // Backend returns Cloudflare CDN URL in variants array
          image.cloudflare?.url || 
          image.imageUrl || 
          image.url
        
        // Only process successful images with valid URLs
        if (imageStatus === 'success' && imageUrl) {
          // Skip if we already have this image
          if (existingImageUrls.has(imageUrl)) {
            logger.log(`⏭️ Skipping duplicate image URL: ${imageUrl}`)
            continue
          }

          // Map external angleIndex/angle_num to actual marketing angle index
          // Backend uses angle_num (string) or angleIndex (number)
          const externalAngleIndex = 
            parseInt(image.angle_num || image.angleIndex || '1', 10)
          const actualAngleIndex = angleIndexMap.get(externalAngleIndex) || externalAngleIndex

          // Get variation number (backend uses variation_num or variationNumber)
          const variationNumber = 
            parseInt(image.variation_num || image.variationNumber || '1', 10)

          // Get angle name (backend uses 'angle' field or adType/name)
          const angleName = 
            image.angle || 
            image.adType || 
            image.name || 
            `Angle ${actualAngleIndex}`

          logger.log(`📸 Processing image: angle_num=${image.angle_num || image.angleIndex}, variation_num=${image.variation_num || image.variationNumber}, url=${imageUrl.substring(0, 50)}...`)

          // Store new image (function will check for duplicates internally)
          const { record: storedAd, isNew } = await createGeneratedStaticAd({
            static_ad_job_id: jobId,
            original_job_id: staticAdJob.original_job_id,
            image_url: imageUrl,
            angle_index: actualAngleIndex,
            variation_number: variationNumber,
            angle_name: angleName,
            status: 'completed'
          })

          // Add to existingImageUrls Set immediately to prevent duplicates in same batch
          existingImageUrls.add(imageUrl)

          // Only process if a new image was actually stored (not a duplicate)
          if (isNew && storedAd) {
            logger.log(`✅ Stored new static ad image: ${imageUrl}`)
            
            // Increment credit usage for this new image (per-image billing)
            // BUT FIRST check if limit has been reached
            if (organizationId) {
              try {
                // Check limit before incrementing
                const limitCheck = await checkUsageLimit(authResult.user, 'static_ads')
                
                if (!limitCheck.allowed) {
                  logger.warn(`⚠️ Limit reached - skipping credit increment for image: ${imageUrl}`)
                  logger.warn(`⚠️ Current usage: ${limitCheck.currentUsage}, Limit: ${limitCheck.limit}`)
                  // Don't increment if limit is reached, but still store the image
                  // (image was already generated by external API, we just won't count it)
                } else {
                  // Limit not reached, safe to increment
                  await incrementOrganizationUsage(organizationId, 'static_ads')
                  logger.log(`💰 Incremented credit usage for new image: ${imageUrl}`)
                }
              } catch (creditError: any) {
                // Log but don't fail the request if credit increment fails
                logger.error(`⚠️ Failed to increment credit usage: ${creditError.message}`)
              }
            }
          } else {
            logger.log(`⏭️ Skipped duplicate image: ${imageUrl}`)
          }
        } else {
          // Log why image was skipped
          logger.warn(`⚠️ Skipping image - status: ${imageStatus}, hasUrl: ${!!imageUrl}, image structure: ${JSON.stringify({ status: image.status, success: image.success, hasCloudflare: !!image.cloudflare, hasImageUrl: !!image.imageUrl })}`)
        }
      }

      // Get all stored images (including newly added ones)
      const allStoredAds = await getGeneratedStaticAds(jobId)
      
      // Count successful images from external API response
      const successfulExternalImages = generatedImages.filter((img: any) => img.success !== false)
      const completedImages = allStoredAds.filter(ad => ad.status === 'completed')
      
      // Calculate expected image count from metadata
      // Use angles_count and images_per_angle from metadata
      let expectedImageCount = 0
      const metadata = resultData.metadata || externalData.metadata || {}
      
      if (metadata.angles_count && metadata.images_per_angle) {
        // Use metadata if available (angles_count * images_per_angle)
        expectedImageCount = metadata.angles_count * metadata.images_per_angle
        logger.log(`📊 Expected images from metadata: ${metadata.angles_count} angles × ${metadata.images_per_angle} images = ${expectedImageCount}`)
      } else if (metadata.selectedAnglesCount) {
        // Fallback to selectedAnglesCount
        expectedImageCount = metadata.selectedAnglesCount * 2
      } else if (metadata.variationsGenerated) {
        // Use variationsGenerated if available
        expectedImageCount = metadata.variationsGenerated
      } else {
        // Calculate from unique angles in generated images
        const uniqueAngles = new Set(successfulExternalImages.map((img: any) => img.angleIndex || 1))
        expectedImageCount = uniqueAngles.size * 2
      }
      
      // Check if we have any images (from external API or stored)
      const hasImages = generatedImages.length > 0 || completedImages.length > 0
      
      // Only mark as completed if:
      // 1. External API says completed/SUCCEEDED AND we have all expected images
      // 2. OR we have all expected images AND external API status is not "pending"
      const externalSaysCompleted = normalizeStatus(externalData.status) === 'completed'
      const hasAllExpectedImages = expectedImageCount > 0 && 
                                   completedImages.length >= expectedImageCount &&
                                   normalizeStatus(externalData.status) !== 'pending'
      
      // IMPORTANT: If status is SUCCEEDED but images are empty, treat as still processing
      // The backend might be in an intermediate state (analysis done, images pending)
      const isActuallyCompleted = externalSaysCompleted && (hasAllExpectedImages || (expectedImageCount === 0 && hasImages))
      
      logger.log(`📊 Job ${jobId} status check: external=${externalData.status}, expected=${expectedImageCount}, stored=${completedImages.length}, externalImages=${successfulExternalImages.length}, hasImages=${hasImages}, isActuallyCompleted=${isActuallyCompleted}`)

      // Determine final status
      let finalStatus = normalizeStatus(externalData.status || staticAdJob.status)
      const progress = externalData.progress || staticAdJob.progress || 0
      const currentStep = externalData.currentStep || ''
      const errorMessage = externalData.error || null

      // If backend says SUCCEEDED but no images yet, keep it as processing
      if (normalizedStatus === 'completed' && !hasImages && expectedImageCount > 0) {
        logger.log(`⚠️ Backend says SUCCEEDED but no images generated yet (expected ${expectedImageCount}). Keeping status as processing and continuing to poll...`)
        finalStatus = 'processing'
        // Update status to processing to keep polling active
        if (staticAdJob.status !== 'processing') {
          await updateStaticAdJobStatus(
            jobId,
            'processing',
            progress || 50, // Set progress to 50% (analysis done, images pending)
            errorMessage
          )
        }
      } else if (isActuallyCompleted || hasAllExpectedImages) {
        // Mark as completed only when we have images
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

