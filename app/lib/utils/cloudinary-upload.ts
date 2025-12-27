/**
 * Cloudinary upload utility
 * Uploads files to Cloudinary and returns the public URL
 */

import { v2 as cloudinary } from 'cloudinary'
import { logger } from './logger'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

/**
 * Upload a file to Cloudinary and return the public URL
 */
export async function uploadToCloudinary(
  file: File,
  folder?: string
): Promise<string> {
  try {
    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const publicId = folder 
      ? `${folder}/${timestamp}-${randomStr}` 
      : `static-ads/${timestamp}-${randomStr}`
    
    logger.log(`📤 Uploading file to Cloudinary: ${publicId} (${file.size} bytes, type: ${file.type})`)
    
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Convert buffer to base64 data URI for Cloudinary
    const base64Data = buffer.toString('base64')
    const dataUri = `data:${file.type || 'image/jpeg'};base64,${base64Data}`
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: publicId,
      folder: folder || 'static-ads',
      resource_type: 'auto', // Auto-detect image/video
      overwrite: false,
      invalidate: true // Invalidate CDN cache
    })
    
    const publicUrl = result.secure_url
    logger.log(`✅ File uploaded to Cloudinary: ${publicUrl}`)
    
    return publicUrl
  } catch (error: any) {
    logger.error(`❌ Error uploading to Cloudinary: ${error.message}`)
    if (error.http_code) {
      logger.error(`❌ Cloudinary HTTP error: ${error.http_code} - ${error.message}`)
    }
    throw error
  }
}

