import { NextRequest, NextResponse } from 'next/server'
import { uploadToCloudflareImages } from '@/lib/utils/cloudflare-images'
import { logger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    logger.log(`📤 Uploading reference image: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

    // Upload to Cloudflare
    const url = await uploadToCloudflareImages(file, {
      source: 'static-ads-reference',
      uploadedAt: new Date().toISOString()
    })

    logger.log(`✅ Reference image uploaded successfully: ${url}`)

    return NextResponse.json({ url })
  } catch (error: any) {
    logger.error('❌ Error uploading reference image:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload image' },
      { status: 500 }
    )
  }
}
