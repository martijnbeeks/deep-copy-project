/**
 * Builds AI image generation prompts by combining JSON descriptions with dynamic context
 * Based on Python reference implementation for better prompt quality
 */

import Anthropic from '@anthropic-ai/sdk'
import { getImageDescription } from './image-schema-loader'
import { logger } from '@/lib/utils/logger'

export interface ImagePromptContext {
  deepResearch?: string
  angle?: string
  sectionContent?: {
    title: stringnpm
    body: string
  }
  productName?: string
  avatar?: string
  productImage?: string
  language?: string
  targetAge?: string
}

function shouldEmphasizeProductImage(role: string): boolean {
  // Only force prominent product for placements where it makes sense visually.
  // For section images, we want the scene to match the section context first.
  return role === 'hero' || role === 'product-focus' || role === 'sidebar-product'
}

/**
 * Intelligently determine text requirements for an image based on role and content
 */
function determineTextRequirements(
  role: string,
  sectionContent?: { title: string; body: string },
  productName?: string
): {
  needsText: boolean
  textType: 'none' | 'product-name' | 'hook' | 'explanation' | 'benefit'
  textGuidance: string
} {
  // Hero images typically need product name or hook
  if (role === 'hero') {
    return {
      needsText: true,
      textType: productName ? 'product-name' : 'hook',
      textGuidance: productName
        ? `Include the product name "${productName}" prominently in the image. This can be on packaging, labels, or as a subtle text overlay.`
        : 'Include a compelling hook or headline (3-5 words maximum) that captures attention and communicates the key value proposition.'
    }
  }

  // Product focus images need product name
  if (role === 'product-focus' || role === 'sidebar-product') {
    return {
      needsText: true,
      textType: 'product-name',
      textGuidance: productName
        ? `Include the product name "${productName}" if visible on product packaging or labels. Keep it natural and integrated with the product.`
        : 'If the product has visible branding or labels, include them naturally. Otherwise, focus on visual product presentation.'
    }
  }

  // Section images - analyze content to determine if text is needed
  if (role.startsWith('section-')) {
    if (!sectionContent) {
      return {
        needsText: false,
        textType: 'none',
        textGuidance: 'Focus on visual representation. No text needed unless the product name appears naturally on packaging or labels.'
      }
    }

    const title = sectionContent.title.toLowerCase()
    const body = sectionContent.body.toLowerCase()

    // Check if section is explaining something complex (needs explanation text)
    const explanationKeywords = ['how', 'why', 'explain', 'understand', 'learn', 'discover', 'reveal', 'science', 'research', 'study', 'proven']
    const needsExplanation = explanationKeywords.some(keyword => title.includes(keyword) || body.includes(keyword))

    // Check if section is about benefits/features (might need benefit text)
    const benefitKeywords = ['benefit', 'feature', 'advantage', 'improve', 'enhance', 'boost', 'increase', 'better', 'powerful', 'effective']
    const needsBenefit = benefitKeywords.some(keyword => title.includes(keyword) || body.includes(keyword))

    // Check if section is a hook/attention grabber
    const hookKeywords = ['shocking', 'secret', 'amazing', 'incredible', 'unbelievable', 'revolutionary', 'breakthrough', 'miracle']
    const needsHook = hookKeywords.some(keyword => title.includes(keyword) || body.includes(keyword))

    if (needsExplanation) {
      return {
        needsText: true,
        textType: 'explanation',
        textGuidance: 'Include a brief explanatory text or label (3-5 words) that helps illustrate the concept being explained. This could be a diagram label, process step, or key term.'
      }
    }

    if (needsBenefit) {
      return {
        needsText: true,
        textType: 'benefit',
        textGuidance: productName
          ? `Include the product name "${productName}" and a key benefit (3-4 words total) if it enhances the visual message. Otherwise, let the visual speak for itself.`
          : 'Include a key benefit or feature highlight (2-3 words) if it adds value to the visual. Otherwise, focus on compelling visuals.'
      }
    }

    if (needsHook) {
      return {
        needsText: true,
        textType: 'hook',
        textGuidance: 'Include a compelling hook or attention-grabbing text (3-5 words) that matches the section\'s tone. Make it bold and impactful.'
      }
    }

    // Default for section images: usually no text, but allow product name if visible
    return {
      needsText: false,
      textType: 'none',
      textGuidance: productName
        ? `Focus on visual representation. Only include text if the product name "${productName}" appears naturally on packaging, labels, or product itself. Otherwise, let the image be purely visual.`
        : 'Focus on compelling visual representation. No text overlays needed unless product branding appears naturally.'
    }
  }

  // Icons and avatars - no text
  if (role === 'topbar-icon' || role === 'comment-avatar') {
    return {
      needsText: false,
      textType: 'none',
      textGuidance: 'No text needed. Keep it simple and visual.'
    }
  }

  // Default: no text unless product name is naturally visible
  return {
    needsText: false,
    textType: 'none',
    textGuidance: productName
      ? `Focus on visuals. Only include text if "${productName}" appears naturally on product packaging or labels.`
      : 'Focus on compelling visual representation. No text overlays needed.'
  }
}

/**
 * Extract age from avatar description
 */
function extractAgeFromAvatar(avatarText?: string): string {
  if (!avatarText) {
    return "50+ years old" // Default fallback
  }
  
  // Look for age_range pattern: "age_range": "30-65" or "Age Range: 30-65"
  const ageRangeMatch = avatarText.match(/(?:age_range|Age Range)[:\s]+["']?([0-9]+)[-+]?([0-9]+)?["']?/i)
  if (ageRangeMatch) {
    const minAge = ageRangeMatch[1]
    const maxAge = ageRangeMatch[2]
    if (maxAge) {
      return `${minAge}-${maxAge} years old`
    } else {
      return `${minAge}+ years old`
    }
  }
  
  // Look for patterns like "30-65", "60-80", "50+"
  const agePattern = avatarText.match(/(\d+)[-+](\d+)?/)
  if (agePattern) {
    const minAge = agePattern[1]
    const maxAge = agePattern[2]
    if (maxAge) {
      return `${minAge}-${maxAge} years old`
    } else {
      return `${minAge}+ years old`
    }
  }
  
  return "50+ years old" // Default fallback
}

/**
 * Generate 10 prompt variations using Claude based on context
 * This creates diverse, optimized prompts for AI image generation
 */
export async function generatePromptVariations(
  role: string,
  context: ImagePromptContext,
  templateId: string
): Promise<string[]> {
  // Load base description from JSON schema
  const baseDescription = getImageDescription(templateId, role) || ''
  
  // Get dimensions for this role
  const dimensions = getDimensionsForRole(role)
  
  // Extract age from avatar
  const targetAge = context.targetAge || extractAgeFromAvatar(context.avatar)
  
  // Intelligently determine text requirements
  const textRequirements = determineTextRequirements(role, context.sectionContent, context.productName)
  
  // Build context summary for Claude
  const contextSummary = `
IMAGE ROLE: ${role}
DIMENSIONS: ${dimensions.width}x${dimensions.height} pixels
${baseDescription ? `BASE DESCRIPTION: ${baseDescription}` : ''}
${context.productName ? `PRODUCT NAME: ${context.productName}` : ''}
${context.avatar ? `TARGET AVATAR: ${context.avatar.substring(0, 500)}` : ''}
${context.angle ? `MARKETING ANGLE: ${context.angle}` : ''}
${context.deepResearch ? `PRODUCT CONTEXT: ${context.deepResearch.substring(0, 1000)}` : ''}
${context.sectionContent ? `SECTION HEADING: "${context.sectionContent.title}"\nSECTION BODY: "${context.sectionContent.body.substring(0, 500)}"` : ''}
TARGET AGE: ${targetAge}
TEXT GUIDANCE: ${textRequirements.textGuidance}
`.trim()

  // Build Claude prompt
  const claudePrompt = `You are an expert at creating high-converting AI image generation prompts for direct-response marketing.

Based on the following context, generate exactly 10 diverse, optimized prompt variations for AI image generation. Each prompt should:

1. Be specific and detailed enough for high-quality image generation
2. Match the image role and section context perfectly
3. Include authentic photography style requirements (real humans, not CGI)
4. Incorporate the target avatar demographics and marketing angle
5. Follow the text guidance rules (minimal text unless necessary)
6. Be optimized for conversion-focused advertorial/prelander images
7. Include technical requirements (dimensions, quality, style)

CONTEXT:
${contextSummary}

CRITICAL REQUIREMENTS:
- All people in images must look like real humans photographed with a professional camera (not illustrated or CGI)
- Natural skin texture, authentic expressions, realistic lighting
- People must match the target age: ${targetAge}
- Text in image: ${textRequirements.textGuidance}
${context.sectionContent ? `- MUST visually represent: "${context.sectionContent.title}" - ${context.sectionContent.body.substring(0, 200)}` : ''}
- Professional, conversion-focused design
- Dimensions: ${dimensions.width}x${dimensions.height} pixels

Generate 10 distinct prompt variations. Each prompt should be complete and ready to use. Format your response as a numbered list (1-10), with each prompt on its own line or clearly separated.`

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set')
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    logger.log(`[Claude] Generating 10 prompt variations for role "${role}"...`)

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: claudePrompt,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    // Parse the response to extract 10 prompts
    // Claude should return numbered prompts (1-10) or clearly separated prompts
    const prompts: string[] = []
    
    // Try to split by numbered list (1., 2., etc.) or by double newlines
    const lines = responseText.split(/\n+/)
    let currentPrompt = ''
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      
      // Check if this line starts a new numbered prompt (1., 2., etc. or 1) 2) etc.)
      const numberedMatch = trimmed.match(/^\d+[.)]\s*(.+)$/)
      if (numberedMatch) {
        // Save previous prompt if exists
        if (currentPrompt) {
          prompts.push(currentPrompt.trim())
        }
        currentPrompt = numberedMatch[1]
      } else if (trimmed.match(/^prompt\s*\d+[:\-]/i)) {
        // Alternative format: "Prompt 1:", "Prompt 1-", etc.
        if (currentPrompt) {
          prompts.push(currentPrompt.trim())
        }
        currentPrompt = trimmed.replace(/^prompt\s*\d+[:\-]\s*/i, '')
      } else {
        // Continue building current prompt
        if (currentPrompt) {
          currentPrompt += ' ' + trimmed
        } else {
          currentPrompt = trimmed
        }
      }
    }
    
    // Add the last prompt
    if (currentPrompt) {
      prompts.push(currentPrompt.trim())
    }
    
    // If we didn't get 10 prompts, try splitting by double newlines or other patterns
    if (prompts.length < 10) {
      const altPrompts = responseText.split(/\n\s*\n+/).map(p => p.trim()).filter(p => p.length > 50)
      if (altPrompts.length >= 10) {
        prompts.splice(0, prompts.length, ...altPrompts.slice(0, 10))
      } else if (altPrompts.length > prompts.length) {
        prompts.splice(0, prompts.length, ...altPrompts)
      }
    }
    
    // Ensure we have at least some prompts (use the full response if parsing failed)
    if (prompts.length === 0) {
      // Fallback: split by sentences or use the whole response
      const fallbackPrompts = responseText.split(/[.!?]\s+/).filter(p => p.length > 100)
      if (fallbackPrompts.length > 0) {
        prompts.push(...fallbackPrompts.slice(0, 10))
      } else {
        prompts.push(responseText)
      }
    }
    
    // Limit to 10 prompts
    const finalPrompts = prompts.slice(0, 10)
    
    // If we have fewer than 10, pad with variations of the first one
    while (finalPrompts.length < 10 && finalPrompts.length > 0) {
      finalPrompts.push(finalPrompts[0] + ' (variation)')
    }
    
    logger.log(`[Claude] ✅ Generated ${finalPrompts.length} prompt variations for role "${role}"`)
    
    return finalPrompts
  } catch (error: any) {
    logger.error(`[Claude] ❌ Error generating prompt variations: ${error.message}`)
    // Fallback to single prompt if Claude fails
    return [buildImagePrompt(role, context, templateId)]
  }
}

/**
 * Build a context-aware prompt for image generation
 * Enhanced with better structure based on Python reference
 * This is now used as a fallback if Claude prompt generation fails
 */
export function buildImagePrompt(
  role: string,
  context: ImagePromptContext,
  templateId: string
): string {
  // Load base description from JSON schema
  const baseDescription = getImageDescription(templateId, role) || ''
  
  // Get dimensions for this role
  const dimensions = getDimensionsForRole(role)
  
  // Extract age from avatar
  const targetAge = context.targetAge || extractAgeFromAvatar(context.avatar)
  
  // Get language
  const language = context.language || 'English'
  const languageName = language.charAt(0).toUpperCase() + language.slice(1)
  
  // Build context sections
  const avatarContext = context.avatar ? `\nTARGET AVATAR:\n${context.avatar}\n` : ''
  const angleContext = context.angle ? `\nMARKETING ANGLE:\n${context.angle}\n` : ''
  const productContext = context.deepResearch ? `\nPRODUCT CONTEXT:\n${context.deepResearch.substring(0, 800)}...\n` : ''
  const sectionContext = context.sectionContent 
    ? `\nSECTION CONTENT:\nHeading: "${context.sectionContent.title}"\nBody: "${context.sectionContent.body.substring(0, 400)}"\n`
    : ''
  
  // Intelligently determine text requirements
  const textRequirements = determineTextRequirements(role, context.sectionContent, context.productName)
  
  // Build the main prompt
  let prompt = ''
  
  // Start with base description or default
  const baseDesc = baseDescription || generateDefaultDescription(role)
  
  // Replace product name in base description
  let processedBaseDesc = baseDesc
  if (context.productName) {
    processedBaseDesc = processedBaseDesc
      .replace(/\[product\]|the product|product/gi, context.productName)
      .replace(/Hike Footwear|BugMD|Spartan|Blissy/gi, context.productName)
  }
  
  // Build comprehensive prompt
  prompt = `Create a professional marketing image for ${role} position in an advertorial template.

${processedBaseDesc}

${avatarContext}${angleContext}${productContext}${sectionContext}

CRITICAL IMAGE REQUIREMENTS:
- Dimensions: ${dimensions.width}x${dimensions.height} pixels
- Professional quality with clean, modern style and good composition
- Optimized for web use with appropriate file format
- SINGLE SCENE ONLY: Create one coherent, realistic scene. Do NOT create a collage, grid, split-screen, or multi-panel layout.
- NO COMPOSITE: Avoid combining multiple separate scenes into one image.
${context.productImage
  ? (shouldEmphasizeProductImage(role)
      ? '- Product image guidance: Use the provided product image as the main product reference and ensure it is clearly visible and realistically integrated into the scene.'
      : '- Product image guidance: Use the provided product image as a reference for accurate product appearance. If included, integrate it naturally and subtly (do not make the entire image just a product packshot).')
  : ''}
${context.angle ? `- **MARKETING ANGLE FOCUS**: The visual style and mood must align with the marketing angle: ${context.angle}` : ''}
${context.avatar ? `- **AVATAR FOCUS**: All visual elements must resonate with the target avatar: ${context.avatar.substring(0, 200)}` : ''}
- **TARGET AUDIENCE: All people/models/characters in the image must be ${targetAge}** - The target audience age is ${targetAge}, so ensure all people shown in the image appear to be in that age range to better resonate with the target demographic
- **TEXT IN IMAGE (INTELLIGENT GUIDANCE)**: ${textRequirements.textGuidance}
- **AUTHENTIC PHOTOGRAPHY STYLE**: All people in the image must look like they were photographed with a professional camera, not illustrated or digitally rendered. They should have:
  * Natural skin texture with realistic pores and subtle imperfections
  * Authentic facial expressions and natural body language
  * Realistic lighting that matches the scene
  * Natural hair texture and movement
  * Clothing that looks like real fabric, not digital art
  * Overall appearance of a professional lifestyle photograph, not an illustration or AI art
- **NATURAL LIFESTYLE**: People should appear in natural, realistic settings and poses. Avoid overly posed or staged-looking scenarios. The image should feel authentic and relatable.
${context.sectionContent ? `- **SECTION CONTEXT (CRITICAL)**: The image MUST visually represent and match this section's content perfectly:
  * Section Heading: "${context.sectionContent.title}"
  * Section Content: "${context.sectionContent.body.substring(0, 300)}"
  * The image should directly relate to and illustrate what this section is discussing. Ensure the visual elements, scenarios, and imagery align perfectly with the section's message and context.` : ''}
- Ensure all visual elements, scenarios, and messaging make sense for the product, marketing angle, and target avatar
- High-quality, conversion-focused design that supports the marketing message`
  
  // Clean up and return
  return prompt
    .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
    .replace(/\s+/g, ' ') // Normalize whitespace within lines
    .trim()
}

/**
 * Get dimensions for a specific role
 */
function getDimensionsForRole(role: string): { width: number; height: number } {
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
 * Generate a default description based on image role
 */
function generateDefaultDescription(role: string): string {
  const roleDescriptions: Record<string, string> = {
    'hero': 'Professional hero image showcasing the product in a compelling, modern style. Clean product photography with good lighting and professional composition.',
    'section-1': 'Visual representation related to the first section content. Professional photography or illustration style.',
    'section-2': 'Visual representation related to the second section content. Professional photography or illustration style.',
    'section-3': 'Visual representation related to the third section content. Professional photography or illustration style.',
    'section-4': 'Visual representation related to the fourth section content. Professional photography or illustration style.',
    'section-5': 'Visual representation related to the fifth section content. Professional photography or illustration style.',
    'section-6': 'Visual representation related to the sixth section content. Professional photography or illustration style.',
    'section-7': 'Visual representation related to the seventh section content. Professional photography or illustration style.',
    'section-8': 'Visual representation related to the eighth section content. Professional photography or illustration style.',
    'section-9': 'Visual representation related to the ninth section content. Professional photography or illustration style.',
    'section-10': 'Visual representation related to the tenth section content. Professional photography or illustration style.',
    'section-12': 'Visual representation related to the final section content. Professional photography or illustration style.',
    'sidebar-product': 'Product photography suitable for sidebar placement. Clean, professional product shot with neutral background.',
    'topbar-icon': 'Small icon or logo suitable for top bar. Simple, clear, and recognizable.',
    'product-focus': 'Close-up product photography highlighting key features. E-commerce style with clean background.',
  }
  
  return roleDescriptions[role] || 'Professional marketing image with clean, modern style and good composition.'
}


