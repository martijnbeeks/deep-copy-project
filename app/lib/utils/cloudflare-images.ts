import { logger } from '@/lib/utils/logger'

const CLOUDFLARE_IMAGES_ACCOUNT_ID = process.env.CLOUDFLARE_IMAGES_ACCOUNT_ID
const CLOUDFLARE_IMAGES_API_TOKEN = process.env.CLOUDFLARE_IMAGES_API_TOKEN

if (!CLOUDFLARE_IMAGES_ACCOUNT_ID) {
  logger.warn('⚠️ CLOUDFLARE_IMAGES_ACCOUNT_ID is not set')
}

if (!CLOUDFLARE_IMAGES_API_TOKEN) {
  logger.warn('⚠️ CLOUDFLARE_IMAGES_API_TOKEN is not set')
}

/**
 * Upload a file to Cloudflare Images (Images v1 API).
 * Returns the public URL (first variant).
 */
export async function uploadToCloudflareImages(file: File, metadata?: Record<string, any>): Promise<string> {
  if (!CLOUDFLARE_IMAGES_ACCOUNT_ID || !CLOUDFLARE_IMAGES_API_TOKEN) {
    throw new Error('Cloudflare Images is not configured (missing env vars)')
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_IMAGES_ACCOUNT_ID}/images/v1`

  // Convert File to Buffer/Blob for Node fetch FormData
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const formData = new FormData()
  formData.append('file', new Blob([buffer], { type: file.type || 'application/octet-stream' }), file.name || 'upload')
  formData.append('requireSignedURLs', 'false')
  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata))
  }

  logger.log(`📤 Uploading product image to Cloudflare Images...`)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_IMAGES_API_TOKEN}`,
    },
    body: formData,
  })

  const json = await response.json()

  if (!response.ok || !json.success) {
    logger.error(`❌ Cloudflare Images upload failed: ${response.status} ${response.statusText} - ${JSON.stringify(json)}`)
    throw new Error(`Cloudflare Images upload failed: ${json.errors?.[0]?.message || response.statusText}`)
  }

  const url = json?.result?.variants?.[0]
  if (!url) {
    throw new Error('Cloudflare Images upload succeeded but no URL was returned')
  }

  logger.log(`✅ Product image uploaded to Cloudflare Images: ${url}`)
  return url
}


