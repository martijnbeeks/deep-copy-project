import { query } from '@/lib/db/connection'
import { getInjectableTemplateById } from '@/lib/db/queries'

/**
 * Get injectable template for a job
 * Helper function to avoid duplication
 */
export async function getInjectableTemplateForJob(job: any) {
  try {
    // First try to get by template_id
    if (job.template_id) {
      const template = await getInjectableTemplateById(job.template_id)
      if (template) return template
    }
    
    // Fallback to getting by advertorial_type
    const result = await query(
      'SELECT * FROM injectable_templates WHERE advertorial_type = $1 LIMIT 1', 
      [job.advertorial_type]
    )
    return result.rows[0] || null
  } catch (error) {
    return null
  }
}

