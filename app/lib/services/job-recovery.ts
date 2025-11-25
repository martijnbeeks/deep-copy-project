import { deepCopyClient } from '@/lib/clients/deepcopy-client'
import { updateJobStatus, createResult, getRandomInjectableTemplate } from '@/lib/db/queries'
import { processJobResults } from '@/lib/utils/template-injection'

// Get all jobs that are currently in processing status
async function getProcessingJobs() {
  try {
    // Use the existing database connection
    const { query } = await import('@/lib/db/connection')
    
    const result = await query(`
      SELECT id, execution_id, updated_at 
      FROM jobs 
      WHERE status = 'processing' 
      AND execution_id IS NOT NULL
      ORDER BY updated_at DESC
    `)
    
    return result.rows
  } catch (error) {
    return []
  }
}

// Check and update a single job
async function checkJobStatus(job: { id: string; execution_id: string; updated_at: string }) {
  try {
    // Use the job ID directly as the DeepCopy job ID (since we now use DeepCopy job ID as primary key)
    const deepCopyJobId = job.id
    const statusResponse = await deepCopyClient.getJobStatus(deepCopyJobId)
    
    if (statusResponse.status === 'SUCCEEDED') {
      // Job completed - get results and store them
      const result = await deepCopyClient.getJobResult(deepCopyJobId)
      await storeJobResults(job.id, result, deepCopyJobId)
      await updateJobStatus(job.id, 'completed', 100)
      
    } else if (statusResponse.status === 'FAILED') {
      // Job failed
      await updateJobStatus(job.id, 'failed')
      
    } else if (['RUNNING', 'SUBMITTED', 'PENDING'].includes(statusResponse.status)) {
      // Job still processing - let background service handle polling
      
    } else {
      // Unknown status - mark as failed
      await updateJobStatus(job.id, 'failed')
    }
    
  } catch (error) {
    // If we can't check the status, mark as failed
    await updateJobStatus(job.id, 'failed')
  }
}

// Store job results in database
async function storeJobResults(localJobId: string, result: any, deepCopyJobId: string) {
  try {
    // Get job details to determine advertorial type
    const { query } = await import('@/lib/db/connection')
    const jobResult = await query('SELECT advertorial_type FROM jobs WHERE id = $1', [localJobId])
    
    if (jobResult.rows.length === 0) {
      throw new Error('Job not found')
    }
    
    const advertorialType = jobResult.rows[0].advertorial_type as 'listicle' | 'advertorial'
    
          // Process results using template injection system
          const { combinedHtml } = await processJobResults(result, advertorialType, getRandomInjectableTemplate)
          const htmlContent = combinedHtml
    
    // Extract HTML templates count for metadata
    const htmlTemplates = extractHTMLTemplates(result)
    const templateCount = htmlTemplates.length
    
    // Store in database
    await createResult(localJobId, htmlContent, {
      generated_at: new Date().toISOString(),
      word_count: htmlContent.split(' ').length,
      template_used: advertorialType,
      deepcopy_job_id: deepCopyJobId,
      raw_data: result,
      project_name: result.project_name || null,
      timestamp_iso: result.timestamp_iso || null,
      html_templates_count: templateCount
    })

    // Screenshot is stored from avatar extraction (product_image) when job is created
    // product_image comes from avatar API, not from job results
    
  } catch (error) {
    console.error('Error storing job results:', error)
    // Mark job as failed if we can't store results
    try {
      await updateJobStatus(localJobId, 'failed')
    } catch (updateError) {
      console.error('Error updating job status to failed:', updateError)
    }
  }
}

// Create HTML content from DeepCopy results
function createResultsHTML(results: any, sections: string[]) {
  // Extract HTML templates from swipe_results
  const htmlTemplates = extractHTMLTemplates(results)
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DeepCopy AI Results</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
        .section { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; }
        .section h3 { color: #333; margin-top: 0; }
        .content { line-height: 1.6; }
        .preview { background: #fff; padding: 15px; border-radius: 6px; border: 1px solid #e9ecef; max-height: 300px; overflow-y: auto; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat { background: white; padding: 15px; border-radius: 8px; text-align: center; flex: 1; }
        .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
        .stat-label { font-size: 14px; color: #666; }
        .html-template { background: #fff; padding: 20px; margin: 15px 0; border-radius: 8px; border: 2px solid #28a745; }
        .html-template h4 { color: #28a745; margin-top: 0; }
        .html-preview { background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px solid #dee2e6; max-height: 400px; overflow-y: auto; }
        .html-source { background: #2d3748; color: #e2e8f0; padding: 15px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 12px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; }
        .template-meta { background: #e3f2fd; padding: 10px; border-radius: 4px; margin-bottom: 10px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>DeepCopy AI Generated Content</h1>
        <p>Comprehensive research and analysis results</p>
        <div class="stats">
            <div class="stat">
                <div class="stat-number">${sections.length}</div>
                <div class="stat-label">Content Sections</div>
            </div>
            <div class="stat">
                <div class="stat-number">${htmlTemplates.length}</div>
                <div class="stat-label">HTML Templates</div>
            </div>
            <div class="stat">
                <div class="stat-number">${results.project_name || 'N/A'}</div>
                <div class="stat-label">Project Name</div>
            </div>
        </div>
    </div>
    
    <div class="content">
        <h2>Generated Content Sections</h2>
        ${sections.map(section => `
            <div class="section">
                <h3>${section}</h3>
                <div class="preview">
                    ${getSectionContent(results, section)?.substring(0, 1000) || 'Content preview not available'}...
                </div>
            </div>
        `).join('')}
        
        ${htmlTemplates.length > 0 ? `
        <h2>HTML Templates Generated</h2>
        ${htmlTemplates.map((template, index) => `
            <div class="html-template">
                <h4>Template ${index + 1}: ${template.name || 'Unnamed Template'}</h4>
                <div class="template-meta">
                    <strong>Type:</strong> ${template.type || 'Unknown'} | 
                    <strong>Angle:</strong> ${template.angle || 'N/A'} |
                    <strong>Size:</strong> ${template.html ? template.html.length : 0} characters |
                    <strong>Generated:</strong> ${template.timestamp || 'Unknown time'}
                </div>
                <div class="html-preview">
                    <h5>Preview:</h5>
                    <div style="border: 1px solid #ccc; padding: 10px; background: white;">
                        ${template.html || 'No HTML content available'}
                    </div>
                </div>
                <div class="html-source">
                    <h5>Source Code:</h5>
                    ${template.html ? escapeHtml(template.html) : 'No HTML source available'}
                </div>
            </div>
        `).join('')}
        ` : '<div class="section"><h3>No HTML Templates Found</h3><p>No HTML templates were generated for this job.</p></div>'}
    </div>
</body>
</html>`
}

// Extract HTML templates from DeepCopy results
function extractHTMLTemplates(results: any): Array<{name: string, type: string, html: string, timestamp: string, angle?: string}> {
  const templates: Array<{name: string, type: string, html: string, timestamp: string, angle?: string}> = []
  
  try {
    // Check if results has swipe_results array
    if (results.swipe_results && Array.isArray(results.swipe_results)) {
      results.swipe_results.forEach((swipe: any, index: number) => {
        // Extract angle information
        const angle = swipe.angle || swipe.angle_name || swipe.angle_type || `Angle ${index + 1}`
        
        // Extract HTML from each swipe result
        if (swipe.html) {
          templates.push({
            name: swipe.name || `Swipe ${index + 1}`,
            type: swipe.type || 'Unknown',
            html: swipe.html,
            timestamp: swipe.timestamp || new Date().toISOString(),
            angle: angle
          })
        }
        
        // Check for nested HTML in content field (this is the main one the user mentioned)
        if (swipe.content && typeof swipe.content === 'string') {
          // Check if content contains HTML
          if (swipe.content.includes('<html') || swipe.content.includes('<div') || swipe.content.includes('<p')) {
            templates.push({
              name: `${swipe.name || `Swipe ${index + 1}`} - Content`,
              type: 'Content HTML',
              html: swipe.content,
              timestamp: swipe.timestamp || new Date().toISOString(),
              angle: angle
            })
          }
        }
        
        // Check for HTML in other potential fields
        const htmlFields = ['html_content', 'generated_html', 'template_html', 'output_html', 'rendered_html', 'final_html']
        htmlFields.forEach(field => {
          if (swipe[field] && typeof swipe[field] === 'string' && swipe[field].includes('<html')) {
            templates.push({
              name: `${swipe.name || `Swipe ${index + 1}`} - ${field}`,
              type: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              html: swipe[field],
              timestamp: swipe.timestamp || new Date().toISOString(),
              angle: angle
            })
          }
        })
      })
    }
    
    // Also check for HTML in other result fields
    if (results.html_content && typeof results.html_content === 'string' && results.html_content.includes('<html')) {
      templates.push({
        name: 'Main HTML Content',
        type: 'Main Content',
        html: results.html_content,
        timestamp: results.timestamp_iso || new Date().toISOString()
      })
    }
    
    // Check for HTML in results.results
    if (results.results && typeof results.results === 'object') {
      const htmlFields = ['html_content', 'generated_html', 'template_html', 'output_html']
      htmlFields.forEach(field => {
        if (results.results[field] && typeof results.results[field] === 'string' && results.results[field].includes('<html')) {
          templates.push({
            name: `Results - ${field}`,
            type: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            html: results.results[field],
            timestamp: results.timestamp_iso || new Date().toISOString()
          })
        }
      })
    }
    
  } catch (error) {
    // Error extracting templates
  }
  
  return templates
}

// Escape HTML for display in source code sections
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

// Get content for a specific section
function getSectionContent(results: any, section: string): string {
  const key = section.toLowerCase().replace(/\s+/g, '_')
  return results[key] || results[section] || ''
}

// Polling is now handled by the background service

// Main recovery function
export async function recoverProcessingJobs() {
  try {
    const processingJobs = await getProcessingJobs()
    
    if (processingJobs.length === 0) {
      return
    }
    
    // Process jobs in parallel (but limit concurrency)
    const batchSize = 5
    for (let i = 0; i < processingJobs.length; i += batchSize) {
      const batch = processingJobs.slice(i, i + batchSize)
      await Promise.all(batch.map(job => checkJobStatus(job)))
      
      // Small delay between batches to avoid overwhelming the API
      if (i + batchSize < processingJobs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
  } catch (error) {
    // Error during recovery
  }
}
