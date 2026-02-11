/**
 * SOP‑driven image prompt builder for Nano Banana Pro / DeepCopy.
 *
 * This module:
 * - Uses a single Claude call per batch of images
 * - Follows the client's SOP (v4.1) for people vs diagram images, style, no‑text rule, etc.
 * - Does NOT hardcode any roles or per‑role descriptions in TypeScript
 * - Does NOT depend on JSON image description schemas
 */

import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/utils/logger'
import type { TaggedImage } from '@/lib/utils/image-tag-extractor'
import { readFileSync } from 'fs'
import { join } from 'path'

export interface ImagePromptContext {
  deepResearch?: string
  angle?: string
  productName?: string
  avatar?: string
  productImage?: string
  language?: string
  targetAge?: string
}

// Extract age from avatar description (kept to align narrator age with avatar)
function extractAgeFromAvatar(avatarText?: string): string {
  if (!avatarText) {
    return '50+ years old' // Default fallback
  }

  const ageRangeMatch = avatarText.match(
    /(?:age_range|Age Range)[:\s]+["']?([0-9]+)[-+]?([0-9]+)?["']?/i
  )
  if (ageRangeMatch) {
    const minAge = ageRangeMatch[1]
    const maxAge = ageRangeMatch[2]
    if (maxAge) {
      return `${minAge}-${maxAge} years old`
    } else {
      return `${minAge}+ years old`
    }
  }

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

  return '50+ years old'
}

/**
 * Build canonical "state JSON" describing all image slots + product context
 * that we pass to Claude, instead of hardcoding roles in TS.
 */
function buildCanonicalState(taggedImages: TaggedImage[], context: ImagePromptContext) {
  const targetAge = context.targetAge || extractAgeFromAvatar(context.avatar)

  const sections = taggedImages.map((img, index) => ({
    roleId: img.role,
    index,
    heading: img.sectionTitle || img.alt || '',
    body: img.sectionBody || img.surroundingContent || '',
  }))

  return {
    product: {
      name: context.productName || '',
      language: context.language || 'English',
    },
    audience: {
      avatarText: context.avatar || '',
      targetAge,
    },
    marketing: {
      angle: context.angle || '',
    },
    deepResearch: {
      full: context.deepResearch || '',
    },
    page: {
      sections,
    },
  }
}

interface SopPromptPlanImage {
  roleId: string
  sectionIndex: number
  contentType: 'people' | 'diagram'
  templateName: string
  prompt: string
}

interface SopPromptPlan {
  images: SopPromptPlanImage[]
}

/**
 * Generate SOP‑driven prompts for all tagged images in one Claude call.
 *
 * IMPORTANT: No fallbacks. If Claude fails or returns invalid JSON, this
 * will throw and the API will surface an error to the client.
 */
export async function generateSopDrivenPromptsForImages(
  taggedImages: TaggedImage[],
  context: ImagePromptContext
): Promise<{ role: string; prompt: string }[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set')
  }

  if (taggedImages.length === 0) {
    return []
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const canonicalState = buildCanonicalState(taggedImages, context)

  // Load SOP text from the repo so updates don't require code changes.
  // If the file is missing, we still proceed with a compact embedded SOP.
  let sopText = ''
  try {
    const sopPath = join(process.cwd(), 'AI ADV Image Prompt SOP  _ DeepCopy.txt')
    sopText = readFileSync(sopPath, 'utf-8')
  } catch {
    if (typeof (logger as any).warn === 'function') {
      ;(logger as any).warn(
        '[Claude] SOP file not found, using embedded summary instructions instead'
      )
    } else if (typeof (logger as any).log === 'function') {
      ;(logger as any).log(
        '[Claude] SOP file not found, using embedded summary instructions instead'
      )
    }
  }

  const sopSummary = `
You follow the "AI ADVERTORIAL IMAGE PROMPT GENERATION SOP – NANO BANANA PRO v4.1".
Key rules (non‑negotiable):
- ABSOLUTE NO TEXT RULE: no text, labels, words, letters, numbers or captions in any image.
- Every prompt must end with: "no text, no labels, no words, no letters, do not generate any text in the image".
- One consistent narrator character across ALL people images, using the same extremely detailed description verbatim.
- People images: "realistic illustration style, painted quality, clearly illustrated not photographic, high detail rendering".
- Diagrams: semi‑realistic illustration style, no people.
- All images 16:9 aspect ratio.
- First 4 images are problem‑only people images (no split transformations).
- After first 4: emotional/lifestyle content → split transformation people images (NO ARROWS); mechanism/problem/solution/product/ingredient/biological explanations → diagrams, with ~30% more diagrams overall.
- Skip review / testimonial / comments / FAQ sections unless a diagram would really help.
`.trim()

  const systemAndSop = sopText
    ? `You are Nano Banana Pro's advertorial image prompt planner.\nFollow this SOP exactly:\n${sopText}\n\nIf there is any conflict, the NO‑TEXT rule and realistic illustration style rules always win.`
    : sopSummary

  const stateJson = JSON.stringify(canonicalState)

  const claudePrompt = `
${systemAndSop}

You are given a JSON object called "canonicalState" that describes:
- product + audience context
- deep research text
- an ordered list of page sections, each with heading/body and an associated image roleId

Your job:
1) For EVERY image roleId in canonicalState.page.sections, you MUST generate a prompt. Do NOT skip any roleIds.
   - The SOP skip rules (reviews/testimonials/comments/FAQ) apply to SECTION CONTENT, not to image roleIds that are already present in the HTML.
   - For small icons/avatars (roleIds like "topbar-icon", "comment-avatar"): Generate a simple diagram-style prompt with "semi-realistic illustration" style, appropriate icon/avatar description, 16:9 aspect ratio (or match the dimensions if specified), and the no-text clause.
2) For EACH image roleId, decide:
   - Is it PEOPLE content or MECHANISM/DIAGRAM content?
   - Is it among the first 4 images (problem‑only people) or later?
   - Which specific SOP template best matches the section's Big Idea and content?
3) Generate ONE final Nano Banana Pro prompt for that image, strictly following ALL SOP rules:
   - Correct style for people vs diagrams
   - Consistent narrator character description for people images
   - Correct sequencing (first 4 problem‑only, then mostly split transformations for emotional sections, diagrams for mechanisms)
   - No children; "adult family members"/"adult grandchildren" instead
   - NO ARROWS in split transformations (transformation implied visually)
   - Every prompt ends with: "no text, no labels, no words, no letters, do not generate any text in the image"
3) Return the result as STRICT JSON only, no prose, with this TypeScript shape:

{
  "images": [
    {
      "roleId": string,        // exactly matches canonicalState.page.sections[i].roleId
      "sectionIndex": number,  // index of the section in canonicalState.page.sections
      "contentType": "people" | "diagram",
      "templateName": string,
      "prompt": string
    }
  ]
}

CRITICAL REQUIREMENTS:
- You MUST return a prompt for EVERY roleId listed in canonicalState.page.sections. No exceptions.
- If a roleId is present in the HTML (like "topbar-icon", "comment-avatar"), it needs a prompt even if it's small.
- Return ONLY the JSON object. Do NOT include any explanatory text, markdown code blocks, or prose before or after the JSON. Start your response with { and end with }.

canonicalState:
${stateJson}
`.trim()

  logger.log('[Claude] Generating SOP‑driven prompts for tagged images...')

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

  const responseText =
    message.content && message.content[0] && message.content[0].type === 'text'
      ? message.content[0].text
      : ''

  if (!responseText) {
    throw new Error('Claude returned an empty response when generating SOP prompts')
  }

  // Extract JSON from response (Claude may add explanatory text before the JSON)
  let jsonText = responseText.trim()
  
  // Try to find JSON object by looking for the first { that starts a valid JSON structure
  const jsonStart = jsonText.indexOf('{')
  if (jsonStart > 0) {
    // There's text before the JSON, extract from the first {
    jsonText = jsonText.substring(jsonStart)
  }
  
  // Also try to find the last } in case there's trailing text
  const jsonEnd = jsonText.lastIndexOf('}')
  if (jsonEnd > 0 && jsonEnd < jsonText.length - 1) {
    jsonText = jsonText.substring(0, jsonEnd + 1)
  }

  let plan: SopPromptPlan
  try {
    plan = JSON.parse(jsonText) as SopPromptPlan
  } catch (err) {
    logger.error(
      '[Claude] Failed to parse SOP prompt JSON:',
      err,
      'Raw response:',
      responseText,
      'Extracted JSON:',
      jsonText.substring(0, 500)
    )
    throw new Error('Claude returned invalid JSON for SOP prompt plan')
  }

  if (!plan.images || !Array.isArray(plan.images)) {
    throw new Error('Claude SOP plan JSON is missing "images" array')
  }

  const byRole = new Map<string, string>()
  for (const img of plan.images) {
    if (!img.roleId || !img.prompt) continue
    let finalPrompt = img.prompt.trim()
    const noTextClause =
      'no text, no labels, no words, no letters, do not generate any text in the image'
    if (!finalPrompt.toLowerCase().includes('no text, no labels')) {
      if (!finalPrompt.endsWith('.')) {
        finalPrompt += '.'
      }
      finalPrompt += ' ' + noTextClause
    }
    byRole.set(img.roleId, finalPrompt)
  }

  // Validate all tagged images have prompts
  const missingRoles: string[] = []
  for (const img of taggedImages) {
    if (!byRole.has(img.role)) {
      missingRoles.push(img.role)
    }
  }

  if (missingRoles.length > 0) {
    const allRoleIds = taggedImages.map((img) => img.role).join(', ')
    const returnedRoleIds = Array.from(byRole.keys()).join(', ')
    throw new Error(
      `Claude SOP plan did not return prompts for ${missingRoles.length} image role(s): ${missingRoles.join(', ')}. ` +
        `Expected all of: ${allRoleIds}. ` +
        `Got: ${returnedRoleIds || 'none'}`
    )
  }

  const results: { role: string; prompt: string }[] = []
  for (const img of taggedImages) {
    const prompt = byRole.get(img.role)!
    results.push({ role: img.role, prompt })
  }

  logger.log(`[Claude] ✅ Generated SOP prompts for ${results.length} tagged images`)

  return results
}




