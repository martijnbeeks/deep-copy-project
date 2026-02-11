/**
 * Loads image descriptions from JSON schema files
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

export interface ImageDescription {
  [role: string]: {
    description: string
  }
}

/**
 * Load image descriptions from a template's JSON schema file
 */
export function loadImageDescriptions(templateId: string): ImageDescription | null {
  try {
    // Map template ID to JSON file
    // Template IDs like "A00002_Spartan" map to "A00002_Spartan.json"
    // Also handle partial IDs like "A00002" by finding matching files
    const jsonFilesDir = join(process.cwd(), 'json files')
    let jsonPath = join(jsonFilesDir, `${templateId}.json`)
    
    // If file doesn't exist, try to find a file that starts with the template ID
    if (!existsSync(jsonPath)) {
      const files = readdirSync(jsonFilesDir)
      const matchingFile = files.find((file: string) => 
        file.startsWith(templateId) && file.endsWith('.json')
      )
      if (matchingFile) {
        jsonPath = join(jsonFilesDir, matchingFile)
      } else {
        // If still not found, return null (will use default descriptions)
        console.warn(`No JSON file found for template ID: ${templateId}`)
        return null
      }
    }
    
    const schema = JSON.parse(readFileSync(jsonPath, 'utf-8'))
    
    // Extract images section
    const imagesSection = schema.properties?.images?.properties || null
    
    if (!imagesSection) {
      return null
    }
    
    // Convert to our format
    const descriptions: ImageDescription = {}
    for (const [role, value] of Object.entries(imagesSection)) {
      if (typeof value === 'object' && value !== null && 'description' in value) {
        descriptions[role] = {
          description: (value as any).description || ''
        }
      }
    }
    
    return Object.keys(descriptions).length > 0 ? descriptions : null
  } catch (error) {
    console.error(`Error loading image descriptions for ${templateId}:`, error)
    return null
  }
}

/**
 * Get description for a specific image role
 */
export function getImageDescription(templateId: string, role: string): string | null {
  const descriptions = loadImageDescriptions(templateId)
  return descriptions?.[role]?.description || null
}


