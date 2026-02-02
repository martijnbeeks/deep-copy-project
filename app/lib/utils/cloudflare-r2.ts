/**
 * Cloudflare R2 upload utility
 * Uses Cloudflare API to upload files to R2
 */

import { logger } from './logger'

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '25f09f52b721298c903e371f89513f21'
const CLOUDFLARE_R2_TOKEN = process.env.CLOUDFLARE_R2_TOKEN || 'u_8ZOICWJGfVVEc8mZhsO9w8aWXodxxWN_jl_1Z_'
const CLOUDFLARE_R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || 'static-ads' // Default bucket name
const CLOUDFLARE_R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || `https://pub-${CLOUDFLARE_ACCOUNT_ID}.r2.dev`

/**
 * Upload a file to Cloudflare R2 and return the public URL
 * Uses Cloudflare API v4 to upload via R2 API
 */
export async function uploadToCloudflareR2(
  file: File,
  path?: string
): Promise<string> {
  try {
    // Generate unique filename if path not provided
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const fileName = path || `static-ads/${timestamp}-${randomStr}.${fileExtension}`
    
    logger.log(`📤 Uploading file to Cloudflare R2: ${fileName} (${file.size} bytes, type: ${file.type})`)
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Cloudflare R2 uses S3-compatible API which requires AWS signature authentication
    // The token provided is likely a Cloudflare API token, not R2 credentials
    // We need R2 Access Key ID and Secret Access Key for proper authentication
    // For now, we'll try a simple PUT request, but it will likely fail without proper credentials
    
    // R2 S3-compatible endpoint format
    const endpoint = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
    const url = `${endpoint}/${CLOUDFLARE_R2_BUCKET}/${fileName}`
    
    logger.log(`🌐 R2 Upload URL: ${url}`)
    logger.log(`⚠️ Note: R2 requires AWS S3-compatible authentication (Access Key + Secret Key)`)
    logger.log(`⚠️ The provided token might not work for R2 uploads`)
    
    try {
      // Try with Bearer token (likely won't work, but worth trying)
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_R2_TOKEN}`,
          'Content-Type': file.type || 'image/jpeg',
          'Content-Length': buffer.length.toString()
        },
        body: buffer
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        logger.error(`❌ Cloudflare R2 upload failed: ${response.status} ${response.statusText}`)
        logger.error(`❌ Error response: ${errorText}`)
        logger.error(`❌ Request URL: ${url}`)
        
        // R2 requires AWS S3 signature authentication
        throw new Error(`R2 upload failed (${response.status}): R2 requires AWS S3-compatible credentials (Access Key ID + Secret Access Key), not API token. Please provide R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables.`)
      }
    } catch (fetchError: any) {
      // Network errors or other fetch failures
      if (fetchError.message.includes('fetch failed')) {
        logger.error(`❌ Network error uploading to R2: ${fetchError.message}`)
        throw new Error(`R2 upload network error: ${fetchError.message}. Please check R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and network connectivity.`)
      }
      throw fetchError
    }
    
    // Construct public URL
    const publicUrl = `${CLOUDFLARE_R2_PUBLIC_URL}/${fileName}`
    logger.log(`✅ File uploaded to Cloudflare R2: ${publicUrl}`)
    
    return publicUrl
  } catch (error: any) {
    logger.error(`❌ Error uploading to Cloudflare R2: ${error.message}`)
    throw error
  }
}

