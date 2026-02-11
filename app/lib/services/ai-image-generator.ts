/**
 * AI Image Generation Service
 * Uses Google Gemini 3 Pro Image Preview (nano banana) for image generation
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

export interface ImageGenerationOptions {
  prompt: string
  role: string
  dimensions?: {
    width: number
    height: number
  }
  referenceImage?: {
    base64: string
    mimeType: string
  }
  productImage?: {
    base64: string
    mimeType: string
  }
}

export interface ImageGenerationResult {
  url: string
  prompt: string
  dimensions?: {
    width: number
    height: number
  }
}

/**
 * Get default dimensions based on image role
 */
function getDefaultDimensions(role: string): { width: number; height: number } {
  const dimensionMap: Record<string, { width: number; height: number }> = {
    'hero': { width: 1200, height: 600 },
    'product-focus': { width: 800, height: 800 },
    'sidebar-product': { width: 400, height: 400 },
    'section-1': { width: 800, height: 500 },
    'section-2': { width: 800, height: 500 },
    'section-3': { width: 800, height: 500 },
    'section-4': { width: 800, height: 500 },
    'section-5': { width: 800, height: 500 },
    'section-6': { width: 800, height: 500 },
    'section-7': { width: 800, height: 500 },
    'section-8': { width: 800, height: 500 },
    'section-9': { width: 800, height: 500 },
    'section-10': { width: 800, height: 500 },
    'section-12': { width: 800, height: 500 },
    'topbar-icon': { width: 32, height: 32 },
    'comment-avatar': { width: 40, height: 40 },
  }
  
  return dimensionMap[role] || { width: 800, height: 600 }
}

/**
 * Generate image using Google Gemini 3 Pro Image Preview (nano banana)
 * Based on the correct API format: contents array with text and optional images
 */
export async function generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
  const { prompt, role, dimensions, referenceImage, productImage } = options
  
  // Get dimensions
  const finalDimensions = dimensions || getDefaultDimensions(role)
  
  // Validate API key
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }
  
  try {
    console.log(`[Gemini] Generating image for role "${role}"...`)
    console.log(`[Gemini] Prompt: ${prompt.substring(0, 100)}...`)
    
    // Initialize Google Generative AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    
    // Create model with responseModalities to enable image generation
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-pro-image-preview',
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    })
    
    // Build contents array: start with text prompt, then optional images
    // Google Generative AI SDK expects: string for text, or objects with parts
    // Format: [prompt_string, { inlineData: {...} }, { inlineData: {...} }]
    // The prompt already includes dimensions and all context, so use it directly
    const contents: any[] = [prompt]
    
    // Add reference image if provided
    if (referenceImage) {
      contents.push({
        inlineData: {
          data: referenceImage.base64,
          mimeType: referenceImage.mimeType || 'image/png',
        },
      })
    }
    
    // Add product image if provided
    if (productImage) {
      contents.push({
        inlineData: {
          data: productImage.base64,
          mimeType: productImage.mimeType || 'image/jpeg',
        },
      })
    }
    
    // Generate content - pass array of parts
    // The SDK accepts: string, or array of content parts
    const result = await model.generateContent(contents)
    
    // Extract image from response
    // Response structure can vary - check multiple possible structures
    let generatedImageBase64: string | null = null
    let mimeType = 'image/png'
    
    // Try to get parts from different possible response structures
    let parts: any[] = []
    const response = result.response
    
    // Check various possible response structures
    if (response?.parts && Array.isArray(response.parts)) {
      parts = response.parts
    } else if (response?.candidates && Array.isArray(response.candidates) && response.candidates[0]?.content?.parts) {
      parts = response.candidates[0].content.parts
    } else if (result?.response?.parts && Array.isArray(result.response.parts)) {
      parts = result.response.parts
    } else if (result?.candidates && Array.isArray(result.candidates) && result.candidates[0]?.content?.parts) {
      parts = result.candidates[0].content.parts
    } else if (result?.parts && Array.isArray(result.parts)) {
      parts = result.parts
    } else {
      // Log the actual response structure for debugging
      const debugInfo = {
        hasResponse: !!response,
        responseType: typeof response,
        hasParts: response?.parts !== undefined,
        partsType: typeof response?.parts,
        partsIsArray: Array.isArray(response?.parts),
        hasCandidates: response?.candidates !== undefined,
        responseKeys: response ? Object.keys(response) : [],
        resultKeys: result ? Object.keys(result) : [],
        resultType: typeof result,
        hasResultResponse: !!result?.response,
        resultResponseKeys: result?.response ? Object.keys(result.response) : []
      }
      console.error(`[Gemini] Response structure debug:`, debugInfo)
      console.error(`[Gemini] Full result object:`, JSON.stringify(result, null, 2).substring(0, 2000))
      throw new Error(`Invalid response structure from Gemini API: Could not find parts array. Response keys: ${response ? Object.keys(response).join(', ') : 'none'}, Result keys: ${result ? Object.keys(result).join(', ') : 'none'}`)
    }
    
    for (const part of parts) {
      // Check if part has inline_data (the generated image)
      if (part.inlineData && part.inlineData.data) {
        const imageData = part.inlineData.data
        
        // Handle both bytes (Buffer) and base64 string formats
        if (Buffer.isBuffer(imageData)) {
          // Check image format from bytes
          if (imageData[0] === 0x89 && imageData[1] === 0x50 && imageData[2] === 0x4E && imageData[3] === 0x47) {
            // PNG header
            mimeType = 'image/png'
            generatedImageBase64 = imageData.toString('base64')
          } else if (imageData[0] === 0xFF && imageData[1] === 0xD8 && imageData[2] === 0xFF) {
            // JPEG header
            mimeType = 'image/jpeg'
            generatedImageBase64 = imageData.toString('base64')
          } else {
            // Default to PNG
            mimeType = part.inlineData.mimeType || 'image/png'
            generatedImageBase64 = imageData.toString('base64')
          }
        } else if (typeof imageData === 'string') {
          // Already base64 encoded
          generatedImageBase64 = imageData
          mimeType = part.inlineData.mimeType || 'image/png'
        }
        
        // Found image, break
        break
      }
    }
    
    if (!generatedImageBase64) {
      throw new Error('No image data found in Gemini API response')
    }
    
    // Convert base64 to data URL for use in HTML
    const imageUrl = `data:${mimeType};base64,${generatedImageBase64}`
    
    console.log(`[Gemini] ✅ Generated image for role "${role}"`)
    
    return {
      url: imageUrl,
      prompt,
      dimensions: finalDimensions
    }
  } catch (error: any) {
    console.error(`[Gemini] ❌ Error generating image for role "${role}":`, error.message)
    throw new Error(`Failed to generate image: ${error.message}`)
  }
}

/**
 * Generate multiple images in batch
 */
export async function generateImagesBatch(
  requests: ImageGenerationOptions[]
): Promise<ImageGenerationResult[]> {
  const results: ImageGenerationResult[] = []
  
  // Process sequentially to avoid rate limits
  for (const request of requests) {
    try {
      const result = await generateImage(request)
      results.push(result)
      
      // Wait 2 seconds between requests to respect rate limits
      if (requests.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    } catch (error) {
      console.error(`Error generating image for role ${request.role}:`, error)
      // Continue with other images even if one fails
    }
  }
  
  return results
}


