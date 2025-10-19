import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { deepCopyClient } from '@/lib/api/deepcopy-client'
import { updateJobStatus, createResult } from '@/lib/db/queries'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
    
    // Get job from database
    const result = await query(`
      SELECT id, execution_id, status 
      FROM jobs 
      WHERE id = $1
    `, [jobId])
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    
    const job = result.rows[0]
    
    // Use the job ID directly as the DeepCopy job ID (since we now use DeepCopy job ID as primary key)
    const deepCopyJobId = jobId
    
    // Get current database status first
    const currentJob = await query(`
      SELECT status, progress, updated_at 
      FROM jobs 
      WHERE id = $1
    `, [jobId])
    
    const dbStatus = currentJob.rows[0]
    
    // Always poll the DeepCopy API to get the real status
    // Don't skip API calls even for completed jobs
    
    // Poll the DeepCopy API only if job is not completed
    let statusResponse
    try {
      statusResponse = await deepCopyClient.getJobStatus(deepCopyJobId)
    } catch (apiError) {
      console.error('❌ DeepCopy API Error in status check:', apiError)
      // If API call fails, return current database status instead of error
      const errorResponse = NextResponse.json({
        status: dbStatus.status,
        progress: dbStatus.progress,
        updated_at: dbStatus.updated_at,
        deepcopy_status: 'API_ERROR',
        deepcopy_response: { error: 'Failed to poll DeepCopy API', details: apiError instanceof Error ? apiError.message : String(apiError) }
      })

      // Add cache-busting headers
      errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      errorResponse.headers.set('Pragma', 'no-cache')
      errorResponse.headers.set('Expires', '0')
      errorResponse.headers.set('X-Timestamp', Date.now().toString())

      return errorResponse
    }
    
    // Update our database with the status
    if (statusResponse.status === 'SUCCEEDED') {
      await updateJobStatus(jobId, 'completed', 100)
      
      // Get results and store them
      try {
        const result = await deepCopyClient.getJobResult(deepCopyJobId)
        await storeJobResults(jobId, result, deepCopyJobId)
      } catch (resultError) {
        console.error('❌ Error fetching/storing job results:', resultError)
        // Continue even if result fetching fails
      }
      
    } else if (statusResponse.status === 'FAILED') {
      await updateJobStatus(jobId, 'failed')
      
    } else if (['RUNNING', 'SUBMITTED', 'PENDING'].includes(statusResponse.status)) {
      const progress = statusResponse.status === 'SUBMITTED' ? 25 : 
                     statusResponse.status === 'RUNNING' ? 50 : 30
      await updateJobStatus(jobId, 'processing', progress)
    }
    
    // Get updated job status from database
    const updatedJob = await query(`
      SELECT status, progress, updated_at 
      FROM jobs 
      WHERE id = $1
    `, [jobId])
    
    const currentStatus = updatedJob.rows[0]
    
    // Check if templates are missing for completed jobs
    if (currentStatus.status === 'completed') {
      const templateCount = await query(`
        SELECT COUNT(*) as count
        FROM injected_templates 
        WHERE job_id = $1
      `, [jobId])
      
      const count = parseInt(templateCount.rows[0].count)
      if (count === 0) {
        console.log(`🔧 No templates found for completed job ${jobId}, generating...`)
        try {
          const result = await deepCopyClient.getJobResult(deepCopyJobId)
          const templateResult = await generateAndStoreInjectedTemplates(jobId, result)
          console.log('📊 Template generation result:', templateResult)
        } catch (error) {
          console.error('❌ Error generating templates for completed job:', error)
        }
      }
    }

    const response = NextResponse.json({
      status: currentStatus.status,
      progress: currentStatus.progress || 0,
      updated_at: currentStatus.updated_at,
      deepcopy_status: statusResponse.status,
      deepcopy_response: statusResponse
    })

    // Add cache-busting headers to prevent Vercel/CDN caching
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('X-Timestamp', Date.now().toString())

    return response
    
  } catch (error) {
    console.error('❌ Job Status Error:', error)
    return NextResponse.json(
      { error: 'Failed to check job status', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// Extract HTML templates from DeepCopy results
function extractHTMLTemplates(results: any): Array<{name: string, type: string, html: string, timestamp: string}> {
  const templates: Array<{name: string, type: string, html: string, timestamp: string}> = []
  
  try {
    // Check if results has swipe_results array
    if (results.swipe_results && Array.isArray(results.swipe_results)) {
      results.swipe_results.forEach((swipe: any, index: number) => {
        // Extract HTML from each swipe result
        if (swipe.html) {
          templates.push({
            name: swipe.name || `Swipe ${index + 1}`,
            type: swipe.type || 'Unknown',
            html: swipe.html,
            timestamp: swipe.timestamp || new Date().toISOString()
          })
        }
        
        // Check for nested HTML in other fields
        if (swipe.content && typeof swipe.content === 'string' && swipe.content.includes('<html')) {
          templates.push({
            name: `${swipe.name || `Swipe ${index + 1}`} - Content`,
            type: 'Content HTML',
            html: swipe.content,
            timestamp: swipe.timestamp || new Date().toISOString()
          })
        }
        
        // Check for HTML in other potential fields
        const htmlFields = ['html_content', 'generated_html', 'template_html', 'output_html']
        htmlFields.forEach(field => {
          if (swipe[field] && typeof swipe[field] === 'string' && swipe[field].includes('<html')) {
            templates.push({
              name: `${swipe.name || `Swipe ${index + 1}`} - ${field}`,
              type: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              html: swipe[field],
              timestamp: swipe.timestamp || new Date().toISOString()
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

    // Generate and store injected templates for each angle
    const templateResult = await generateAndStoreInjectedTemplates(localJobId, result)
    console.log('📊 Template generation result:', templateResult)
    
  } catch (error) {
    // Error storing results
  }
}

async function generateAndStoreInjectedTemplates(jobId: string, result: any) {
  try {
    console.log(`🔧 Starting injected template generation for job ${jobId}`)
    
    // Get job details to find template_id and advertorial_type
    const jobResult = await query(`
      SELECT template_id, advertorial_type, title
      FROM jobs 
      WHERE id = $1
    `, [jobId])
    
    if (jobResult.rows.length === 0) {
      console.error('❌ Job not found for injected template generation:', jobId)
      return { success: false, error: 'Job not found' }
    }
    
    const job = jobResult.rows[0]
    console.log(`📊 Job details: template_id=${job.template_id}, type=${job.advertorial_type}`)
    
    // Get the injectable template
    const injectableTemplate = await getInjectableTemplateForJob(job)
    
    if (!injectableTemplate) {
      console.error('❌ No injectable template found for job:', jobId, 'template_id:', job.template_id)
      return { success: false, error: `No injectable template found for template_id: ${job.template_id}` }
    }
    
    console.log(`✅ Found injectable template: ${injectableTemplate.id}`)
    
    // Check if we have swipe_results in the result
    const apiResult = result.results || result
    console.log(`📊 API Result structure:`, Object.keys(apiResult))
    
    // Look for swipe_results in the correct location
    let swipeResults = apiResult.swipe_results || 
                      apiResult.full_result?.results?.swipe_results || 
                      apiResult.full_result?.swipe_results ||
                      []
    
    console.log(`📊 Swipe results found:`, swipeResults ? swipeResults.length : 0)
    
    // If swipeResults is an object, convert it to an array
    if (swipeResults && typeof swipeResults === 'object' && !Array.isArray(swipeResults)) {
      swipeResults = Object.values(swipeResults)
      console.log(`📊 Converted object to array, length:`, swipeResults.length)
    }
    
    if (!swipeResults || !Array.isArray(swipeResults) || swipeResults.length === 0) {
      console.error('❌ No swipe_results found for job:', jobId)
      console.error('❌ Available keys in result:', Object.keys(result))
      console.error('❌ Available keys in apiResult:', Object.keys(apiResult))
      return { success: false, error: 'No swipe_results found in API response' }
    }
    
    // Extract angles from swipe results
    const angles = swipeResults.map((swipe, index) => {
      if (swipe && typeof swipe === 'object') {
        return swipe.angle || swipe.angle_name || `Angle ${index + 1}`
      }
      return `Angle ${index + 1}`
    })
    
    console.log(`Generating injected templates for job ${jobId} with ${angles.length} angles`)
    
    // Create injected_templates table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS injected_templates (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        angle_index INTEGER NOT NULL,
        angle_name VARCHAR(255) NOT NULL,
        html_content TEXT NOT NULL,
        template_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    
    // Process each angle
    let successCount = 0
    let errorCount = 0
    
    for (let i = 0; i < angles.length; i++) {
      const angle = angles[i]
      const swipeResult = swipeResults[i]
      
      if (swipeResult) {
        try {
          console.log(`🔧 Processing angle ${i + 1}/${angles.length}: ${angle}`)
          
          // Import template injection utilities
          const { extractContentFromSwipeResult, injectContentIntoTemplate } = await import('@/lib/utils/template-injection')
          
          // Extract content from swipe result
          const contentData = extractContentFromSwipeResult(swipeResult, job.advertorial_type)
          console.log(`📊 Content data extracted for angle ${i + 1}`)
          
          // Inject content into template
          const injectedHtml = injectContentIntoTemplate(injectableTemplate, contentData)
          console.log(`📊 Template injected for angle ${i + 1}, HTML length: ${injectedHtml.length}`)
          
          // Store the injected template
          await query(`
            INSERT INTO injected_templates (job_id, angle_index, angle_name, html_content, template_id)
            VALUES ($1, $2, $3, $4, $5)
          `, [jobId, i + 1, angle || `Angle ${i + 1}`, injectedHtml, job.template_id])
          
          console.log(`✅ Generated injected template for angle ${i + 1}: ${angle}`)
          successCount++
        } catch (error) {
          console.error(`❌ Error generating injected template for angle ${i + 1}:`, error)
          errorCount++
        }
      } else {
        console.error(`❌ No swipe result data for angle ${i + 1}`)
        errorCount++
      }
    }
    
    console.log(`✅ Generated ${successCount}/${angles.length} injected templates for job ${jobId}`)
    if (errorCount > 0) {
      console.error(`❌ Failed to generate ${errorCount} templates`)
    }
    
    return { 
      success: successCount > 0, 
      generated: successCount, 
      total: angles.length, 
      errors: errorCount 
    }
  } catch (error) {
    console.error('❌ Error generating injected templates:', error)
    return { success: false, error: error.message }
  }
}

async function getInjectableTemplateForJob(job: any) {
  try {
    // First try to get by template_id
    if (job.template_id) {
      const result = await query('SELECT * FROM injectable_templates WHERE id = $1', [job.template_id])
      if (result.rows.length > 0) return result.rows[0]
    }
    
    // Fallback to getting by advertorial_type
    const result = await query('SELECT * FROM injectable_templates WHERE advertorial_type = $1 LIMIT 1', [job.advertorial_type])
    return result.rows[0] || null
  } catch (error) {
    console.error('Error fetching injectable template:', error)
    return null
  }
}
