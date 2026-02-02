import { NextRequest, NextResponse } from 'next/server'
import { createStaticAdJob } from '@/lib/db/queries'
import { getJobById } from '@/lib/db/queries'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { checkUsageLimit } from '@/lib/middleware/usage-limits'
import { logger } from '@/lib/utils/logger'
import { getDeepCopyAccessToken } from '@/lib/auth/deepcopy-auth'
import { uploadToCloudflareImages } from '@/lib/utils/cloudflare-images'
import { query } from '@/lib/db/connection'

const STATIC_ADS_API_URL = process.env.STATIC_ADS_API_URL

if (!STATIC_ADS_API_URL) {
  logger.error('❌ STATIC_ADS_API_URL environment variable is not set')
}

export async function POST(request: NextRequest) {
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
    const user = authResult.user

    // Parse multipart/form-data
    const formData = await request.formData()

    const originalJobId = formData.get('original_job_id') as string
    const selectedAvatar = formData.get('selectedAvatar') as string
    const foundationalDocText = formData.get('foundationalDocText') as string | null
    const productImage = formData.get('productImage') as File | null
    const language = (formData.get('language') as string) || 'english'
    const productName = formData.get('productName') as string | null
    const enableVideoScripts = (formData.get('enableVideoScripts') as string) || 'false'

    // Get selected angles (multiple form fields with same name)
    const selectedAngles: string[] = []
    formData.forEach((value, key) => {
      if (key === 'selectedAngles' && typeof value === 'string') {
        selectedAngles.push(value)
      }
    })

    // Get forced reference image IDs (multiple form fields with same name)
    const forcedReferenceImageIds: string[] = []
    formData.forEach((value, key) => {
      if (key === 'forcedReferenceImageIds' && typeof value === 'string') {
        forcedReferenceImageIds.push(value)
      }
    })

    // Validation
    if (!originalJobId) {
      return createValidationErrorResponse('original_job_id is required')
    }

    if (!selectedAvatar) {
      return createValidationErrorResponse('selectedAvatar is required')
    }

    if (!selectedAngles || selectedAngles.length === 0) {
      return createValidationErrorResponse('At least one selectedAngles is required')
    }

    // Verify original job exists and belongs to user
    const originalJob = await getJobById(originalJobId, user.id)
    if (!originalJob) {
      return createValidationErrorResponse('Original job not found', 404)
    }

    // Check usage limits before creating new static ad job
    // Note: We only check here, credits are deducted per image when images are stored
    // This prevents users from starting jobs when they have no credits left
    const usageCheck = await checkUsageLimit(user, 'static_ads')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Usage limit exceeded',
          message: usageCheck.error || `You've reached your weekly limit of ${usageCheck.limit} Static Ads. Your limit resets automatically based on a rolling 7-day window.`,
          currentUsage: usageCheck.currentUsage,
          limit: usageCheck.limit
        },
        { status: 429 } // Too Many Requests
      )
    }

    // Get full result from database to extract avatar_sheet and full angle information
    let avatarInfo: string = selectedAvatar // Fallback to basic description
    const fullAngles: string[] = []
    
    try {
      // Get the original job result to extract avatar_sheet and marketing_angles
      const resultQuery = await query(
        `SELECT metadata FROM results WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [originalJobId]
      )
      
      if (resultQuery.rows.length > 0) {
        const metadata = resultQuery.rows[0].metadata
        const fullResult = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
        const resultData = fullResult?.full_result || fullResult
        
        // Extract avatar from avatar_sheet in results
        // avatar_sheet is a JSON string containing the full avatar object
        const avatarSheet = resultData?.results?.avatar_sheet || resultData?.avatar_sheet
        
        if (avatarSheet) {
          // avatar_sheet is already a JSON string, just use it directly
          if (typeof avatarSheet === 'string') {
            avatarInfo = avatarSheet
            logger.log(`✅ Using avatar from avatar_sheet (JSON string)`)
          } else {
            // If it's already an object, stringify it
            avatarInfo = JSON.stringify(avatarSheet)
            logger.log(`✅ Using avatar from avatar_sheet (object)`)
          }
        }
        
        // Get marketing angles from results
        const marketingAngles = resultData?.results?.marketing_angles || resultData?.marketing_angles || []
        
        // For each selected angle, find the full angle object and format it
        selectedAngles.forEach((selectedAngleString) => {
          // Find the matching angle in marketing angles
          const fullAngle = marketingAngles.find((angle: any) => {
            // Match by title or description
            const angleTitle = angle.title || (typeof angle === 'string' ? angle.split(':')[0] : '')
            const angleDesc = typeof angle === 'string' ? angle : (angle.angle || angle.description || '')
            const angleString = angleTitle ? `${angleTitle}: ${angleDesc}` : angleDesc
            
            return angleString === selectedAngleString || 
                   angleDesc === selectedAngleString ||
                   angleTitle === selectedAngleString
          })
          
          if (fullAngle) {
            // Format the full angle information as a string
            const angleText = formatFullAngleAsString(fullAngle)
            fullAngles.push(angleText)
            logger.log(`✅ Using full angle information for: ${fullAngle.title || fullAngle.angle || fullAngle}`)
          } else {
            // Fallback to selected angle string if not found
            fullAngles.push(selectedAngleString)
            logger.warn(`⚠️ Full angle not found for: ${selectedAngleString}, using basic string`)
          }
        })
      } else {
        // Fallback: use selected angles as-is if no results found
        selectedAngles.forEach(angle => fullAngles.push(angle))
        logger.warn(`⚠️ No results found for job ${originalJobId}, using basic angle strings`)
      }
    } catch (error: any) {
      logger.error(`❌ Error getting avatar and angle information: ${error.message}`)
      // Fallback: use selected angles as-is
      selectedAngles.forEach(angle => fullAngles.push(angle))
    }

    // Prepare JSON body for external API (API expects JSON, not FormData)
    const requestBody: any = {
      selectedAvatar: avatarInfo, // Now contains full avatar from avatar_sheet (JSON string)
      selectedAngles: fullAngles.length > 0 ? fullAngles : selectedAngles, // Full angle info or fallback
      language: language || 'english'
    }

    if (foundationalDocText) {
      requestBody.foundationalDocText = foundationalDocText
    }

    // Handle productImage - Upload to Cloudflare Images and get URL
    if (productImage) {
      try {
        const productImageUrl = await uploadToCloudflareImages(productImage, { source: 'static-ads', jobId: originalJobId })
        requestBody.productImageUrls = [productImageUrl]
        logger.log(`✅ Product image uploaded to Cloudflare Images: ${productImageUrl}`)
      } catch (uploadError: any) {
        logger.error(`❌ Failed to upload product image to Cloudflare Images: ${uploadError.message}`)
        // Don't fail the entire request if image upload fails
        // Log warning but proceed - the API might still work without product image
        logger.warn(`⚠️ Proceeding without product image - API might still work or might require it`)
      }
    }

    if (forcedReferenceImageIds.length > 0) {
      requestBody.forcedReferenceImageIds = forcedReferenceImageIds
    }
    
    if (productName) {
      requestBody.productName = productName
    }
    
    // Note: enableVideoScripts might not be in the API spec, but keeping it for now
    // The API might ignore unknown fields
    if (enableVideoScripts && enableVideoScripts !== 'false') {
      requestBody.enableVideoScripts = enableVideoScripts === 'true'
    }

    // Submit to external API with long timeout (30 minutes = 1800000ms)
    logger.log(`🔧 Submitting static ad generation job to external API for job ${originalJobId}`)
    logger.log(`🔗 API URL: ${STATIC_ADS_API_URL}`)
    logger.log(`📋 Endpoint: /image-gen/generate`)
    logger.log(`📦 Request body (summary): ${JSON.stringify({ ...requestBody, foundationalDocText: foundationalDocText ? `[${foundationalDocText.length} chars]` : undefined }, null, 2)}`)
    
    // Get OAuth2 access token
    let accessToken: string
    try {
      logger.log(`🔐 Requesting OAuth2 access token...`)
      accessToken = await getDeepCopyAccessToken()
      logger.log(`✅ OAuth2 token acquired (length: ${accessToken.length})`)
    } catch (authError: any) {
      logger.error(`❌ Failed to get OAuth2 token: ${authError.message}`)
      throw new Error(`Authentication failed: ${authError.message}`)
    }
    
    // Use AbortSignal.timeout which handles both headers and body timeout
    // This is better than AbortController for fetch as it properly handles undici's timeout behavior
    const timeoutSignal = AbortSignal.timeout(1800000) // 30 minutes

    const apiEndpoint = `${STATIC_ADS_API_URL}/image-gen/generate`
    
    // ============================================
    // DETAILED REQUEST LOG FOR BACKEND ENGINEER
    // ============================================
    logger.log(`\n${'='.repeat(80)}`)
    logger.log(`📤 FULL REQUEST DETAILS (for backend engineer):`)
    logger.log(`${'='.repeat(80)}`)
    logger.log(`Method: POST`)
    logger.log(`URL: ${apiEndpoint}`)
    logger.log(`Headers:`)
    logger.log(`  Authorization: Bearer ${accessToken.substring(0, 20)}...${accessToken.substring(accessToken.length - 10)} (length: ${accessToken.length})`)
    logger.log(`  Content-Type: application/json`)
    logger.log(`\nRequest Body (FULL):`)
    logger.log(`${JSON.stringify(requestBody, null, 2)}`)
    logger.log(`${'='.repeat(80)}\n`)
    // ============================================
    
    logger.log(`🌐 Making request to: ${apiEndpoint}`)

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: timeoutSignal,
        // AbortSignal.timeout handles both headers timeout and body timeout in undici
      } as any)
      
      logger.log(`📡 Response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(`❌ External API error: ${response.status} ${response.statusText}`)
        logger.error(`❌ Error response body: ${errorText}`)
        logger.error(`❌ Request URL: ${apiEndpoint}`)
        logger.error(`❌ Request method: POST`)
        throw new Error(`External API error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      logger.log(`📥 Response body: ${JSON.stringify(result, null, 2)}`)
      
      const externalJobId = result.jobId

      if (!externalJobId) {
        logger.error(`❌ Response missing jobId. Full response: ${JSON.stringify(result, null, 2)}`)
        throw new Error('External API did not return a job ID')
      }

      logger.log(`✅ Static ad job created: ${externalJobId} for original job ${originalJobId}`)

      // Create static ad job in database with selected angles for angle index mapping
      const staticAdJob = await createStaticAdJob({
        original_job_id: originalJobId,
        external_job_id: externalJobId,
        user_id: user.id,
        selected_angles: selectedAngles
      })

      return createSuccessResponse({
        jobId: staticAdJob.id,
        externalJobId: externalJobId,
        message: 'Static ad generation job created successfully'
      })
    } catch (error: any) {
      // Handle timeout errors - undici throws UND_ERR_HEADERS_TIMEOUT when headers timeout is exceeded
      if (error.name === 'AbortError' || error.code === 'UND_ERR_HEADERS_TIMEOUT' || error.message?.includes('timeout') || error.message?.includes('Headers Timeout')) {
        logger.error(`❌ Request timeout: ${error.message || 'The external API did not respond within 30 minutes'}`)
        throw new Error('Request timeout: The external API did not respond within 30 minutes. The job may still be processing - please check the status later.')
      }
      throw error
    }
  } catch (error) {
    return handleApiError(error)
  }
}

// Helper function to format full angle as string
function formatFullAngleAsString(angle: any): string {
  // Handle string angles (fallback)
  if (typeof angle === 'string') {
    return angle
  }
  
  const parts: string[] = []
  
  // Title and Description
  const title = angle.title || (angle.angle?.split(':')[0]?.trim() || '')
  const description = angle.description || (angle.angle?.includes(':') ? angle.angle.split(':').slice(1).join(':').trim() : angle.angle || '')
  
  if (title) parts.push(title)
  if (description) parts.push(description)
  
  // Target Age Range
  if (angle.target_age_range) {
    parts.push(`\nTarget Age Range\n${angle.target_age_range}`)
  }
  
  // Target Audience
  if (angle.target_audience) {
    parts.push(`\nTarget Audience\n${angle.target_audience}`)
  }
  
  // Pain Points
  if (angle.pain_points && Array.isArray(angle.pain_points) && angle.pain_points.length > 0) {
    parts.push(`\nPain Points`)
    angle.pain_points.forEach((point: string) => {
      parts.push(`• ${point}`)
    })
  }
  
  // Desires
  if (angle.desires && Array.isArray(angle.desires) && angle.desires.length > 0) {
    parts.push(`\nDesires`)
    angle.desires.forEach((desire: string) => {
      parts.push(`• ${desire}`)
    })
  }
  
  // Common Objections
  if (angle.common_objections && Array.isArray(angle.common_objections) && angle.common_objections.length > 0) {
    parts.push(`\nCommon Objections`)
    angle.common_objections.forEach((objection: string) => {
      parts.push(`• ${objection}`)
    })
  }
  
  // Failed Alternatives
  if (angle.failed_alternatives && Array.isArray(angle.failed_alternatives) && angle.failed_alternatives.length > 0) {
    parts.push(`\nFailed Alternatives`)
    angle.failed_alternatives.forEach((alt: string) => {
      parts.push(`• ${alt}`)
    })
  }
  
  // Copy Approach
  if (angle.copy_approach && Array.isArray(angle.copy_approach) && angle.copy_approach.length > 0) {
    parts.push(`\nCopy Approach`)
    angle.copy_approach.forEach((approach: string) => {
      parts.push(`• ${approach}`)
    })
  }
  
  return parts.join('\n')
}

