import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { deepCopyClient } from '@/lib/api/deepcopy-client'
import { updateJobStatus, createResult } from '@/lib/db/queries'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting job recovery process...')
    
    // Get all jobs that are not completed/failed (including failed ones that might still be running)
    const result = await query(`
      SELECT id, execution_id, status, updated_at 
      FROM jobs 
      WHERE status IN ('pending', 'processing', 'failed')
      ORDER BY updated_at DESC
    `)
    
    const jobsToCheck = result.rows
    console.log(`Found ${jobsToCheck.length} jobs with DeepCopy execution IDs`)
    
    if (jobsToCheck.length === 0) {
      console.log('✓ No jobs need recovery')
      return NextResponse.json({ 
        success: true, 
        message: 'No jobs need recovery',
        recovered: 0 
      })
    }
    
    let recovered = 0
    let failed = 0
    
    // Process jobs in parallel (but limit concurrency)
    const batchSize = 3
    for (let i = 0; i < jobsToCheck.length; i += batchSize) {
      const batch = jobsToCheck.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(job => checkJobStatus(job))
      )
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          recovered++
        } else {
          failed++
          console.error(`Failed to recover job ${batch[index].id}:`, result.reason)
        }
      })
      
      // Small delay between batches to avoid overwhelming the API
      if (i + batchSize < jobsToCheck.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    console.log(`✓ Job recovery completed - Recovered: ${recovered}, Failed: ${failed}`)
    
    return NextResponse.json({
      success: true,
      message: `Recovered ${recovered} jobs, ${failed} failed`,
      recovered,
      failed,
      total: jobsToCheck.length
    })
    
  } catch (error) {
    console.error('Error during job recovery:', error)
    return NextResponse.json(
      { 
      success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

// Check and update a single job
async function checkJobStatus(job: { id: string; execution_id: string; status: string; updated_at: string }) {
  try {
    // Use the job ID directly as the DeepCopy job ID (since we now use DeepCopy job ID as primary key)
    const deepCopyJobId = job.id
    console.log(`🔍 Checking job ${job.id} (current status: ${job.status}) with DeepCopy ID: ${deepCopyJobId}`)
    console.log(`📡 Polling DeepCopy API: https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/jobs/${deepCopyJobId}`)
    
    const statusResponse = await deepCopyClient.getJobStatus(deepCopyJobId)
    console.log(`📊 DeepCopy API response for job ${job.id}:`, statusResponse)
    
    if (statusResponse.status === 'SUCCEEDED') {
      // Job completed - get results and store them
      console.log(`✅ Job ${job.id} succeeded, fetching results...`)
      const result = await deepCopyClient.getJobResult(deepCopyJobId)
      await storeJobResults(job.id, result, deepCopyJobId)
      await updateJobStatus(job.id, 'completed', 100)
      console.log(`✓ Recovered completed job: ${job.id}`)
      
    } else if (statusResponse.status === 'FAILED') {
      // Job failed
      await updateJobStatus(job.id, 'failed')
      console.log(`❌ Job ${job.id} failed on DeepCopy API`)
      
    } else if (['RUNNING', 'SUBMITTED', 'PENDING'].includes(statusResponse.status)) {
      // Job still processing - update progress and let it continue
      const progress = statusResponse.status === 'SUBMITTED' ? 25 : 
                     statusResponse.status === 'RUNNING' ? 50 : 30
      await updateJobStatus(job.id, 'processing', progress)
      
      // If job was previously marked as failed but is actually running, log this
      if (job.status === 'failed') {
        console.log(`🔄 Job ${job.id} was marked as failed but is actually still running (${statusResponse.status}) - corrected status`)
      } else {
        console.log(`🔄 Job ${job.id} still processing (${statusResponse.status}) - will continue polling`)
      }
      
    } else {
      // Unknown status - mark as failed
      await updateJobStatus(job.id, 'failed')
      console.log(`❓ Unknown status for job ${job.id}: ${statusResponse.status}`)
    }
    
  } catch (error) {
    console.error(`❌ Error checking job ${job.id}:`, error)
    // If we can't check the status, mark as failed
    await updateJobStatus(job.id, 'failed')
  }
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
    
    console.log(`📄 Extracted ${templates.length} HTML templates from results`)
    
  } catch (error) {
    console.error('Error extracting HTML templates:', error)
  }
  
  return templates
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

// Store job results in database
async function storeJobResults(localJobId: string, result: any, deepCopyJobId: string) {
  try {
    console.log(`📊 Storing results for job ${localJobId}:`, {
      hasResults: !!result.results,
      hasSwipeResults: !!(result.results && result.results.swipe_results),
      swipeResultsCount: result.results?.swipe_results?.length || 0,
      projectName: result.project_name
    })
    
    // Create HTML content for display
    let htmlContent = ''
    let sections: string[] = []
    
    if (result.results) {
      // Handle nested results structure
      if (result.results.research_page_analysis) sections.push('Research Analysis')
      if (result.results.doc1_analysis) sections.push('Market Research')
      if (result.results.doc2_analysis) sections.push('Customer Research')
      if (result.results.deep_research_output) sections.push('Research Report')
      if (result.results.avatar_sheet) sections.push('Customer Avatars')
      if (result.results.html_content) sections.push('Generated HTML')
      
      // Check for swipe_results
      if (result.results.swipe_results && Array.isArray(result.results.swipe_results)) {
        sections.push(`Swipe Results (${result.results.swipe_results.length} templates)`)
      }
      
      htmlContent = createResultsHTML(result.results, sections)
    } else {
      // Handle direct content
      htmlContent = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    }
    
    // Extract HTML templates count for metadata
    const htmlTemplates = extractHTMLTemplates(result)
    const templateCount = htmlTemplates.length
    
    console.log(`📄 Found ${templateCount} HTML templates in job results`)
    
    // Store the result with full metadata
    await createResult(localJobId, htmlContent, {
      deepcopy_job_id: deepCopyJobId,
      project_name: result.project_name,
      timestamp_iso: result.timestamp_iso,
      full_result: result,
      generated_at: new Date().toISOString(),
      word_count: htmlContent.split(' ').length,
      html_templates_count: templateCount
    })
    
    console.log(`✅ Successfully stored results for job ${localJobId} with ${templateCount} HTML templates`)
    
  } catch (error) {
    console.error('Error storing job results:', error)
  }
}