import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { deepCopyClient } from '@/lib/api/deepcopy-client'
import { updateJobStatus, createResult } from '@/lib/db/queries'

export async function GET(request: NextRequest) {
  // Verify this is a cron request (optional security)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    
    
    // Get all processing jobs
    const result = await query(`
      SELECT id, execution_id, status, updated_at 
      FROM jobs 
      WHERE status = 'processing'
      ORDER BY updated_at DESC
    `)
    
    const processingJobs = result.rows
    
    
    if (processingJobs.length === 0) {
      
      return NextResponse.json({ 
        success: true, 
        message: 'No processing jobs found',
        checked: 0,
        completed: 0,
        failed: 0
      })
    }
    
    let completed = 0
    let failed = 0
    let stillProcessing = 0
    
    // Process jobs in batches to avoid overwhelming the API
    const batchSize = 3
    for (let i = 0; i < processingJobs.length; i += batchSize) {
      const batch = processingJobs.slice(i, i + batchSize)
      
      const results = await Promise.allSettled(
        batch.map(job => checkJobStatus(job))
      )
      
      results.forEach((result, index) => {
        const job = batch[index]
        if (result.status === 'fulfilled') {
          const status = result.value
          if (status === 'completed') completed++
          else if (status === 'failed') failed++
          else stillProcessing++
        } else {
          failed++
          console.error(`Failed to check job ${job.id}:`, result.reason)
        }
      })
      
      // Small delay between batches
      if (i + batchSize < processingJobs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    
    
    return NextResponse.json({
      success: true,
      message: 'Job status check completed',
      checked: processingJobs.length,
      completed,
      failed,
      stillProcessing
    })
    
  } catch (error) {
    console.error('❌ Error in cron job status check:', error)
    return NextResponse.json(
      { 
        error: 'Failed to check job statuses',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Check and update a single job
async function checkJobStatus(job: { id: string; execution_id: string; status: string; updated_at: string }): Promise<string> {
  try {
    const deepCopyJobId = job.id
    `)
    
    const statusResponse = await deepCopyClient.getJobStatus(deepCopyJobId)
    
    
    if (statusResponse.status === 'SUCCEEDED') {
      // Job completed - get results and store them
      
      const result = await deepCopyClient.getJobResult(deepCopyJobId)
      await storeJobResults(job.id, result, deepCopyJobId)
      await updateJobStatus(job.id, 'completed', 100)
      
      return 'completed'
      
    } else if (statusResponse.status === 'FAILED') {
      // Job failed
      await updateJobStatus(job.id, 'failed')
      
      return 'failed'
      
    } else if (['RUNNING', 'SUBMITTED', 'PENDING'].includes(statusResponse.status)) {
      // Job still processing - update progress
      const progress = statusResponse.status === 'SUBMITTED' ? 25 : 
                     statusResponse.status === 'RUNNING' ? 50 : 30
      await updateJobStatus(job.id, 'processing', progress)
      `)
      return 'processing'
      
    } else {
      // Unknown status - mark as failed
      await updateJobStatus(job.id, 'failed')
      
      return 'failed'
    }
    
  } catch (error) {
    console.error(`Error checking job ${job.id}:`, error)
    // If we can't check the status, mark as failed
    await updateJobStatus(job.id, 'failed')
    return 'failed'
  }
}

// Store job results in database
async function storeJobResults(localJobId: string, result: any, deepCopyJobId: string) {
  try {
    
    
    // Extract HTML templates from the result
    const templates = extractHTMLTemplates(result)
    
    if (templates.length === 0) {
      
      return
    }
    
    // Store each template as a result
    for (const template of templates) {
      await createResult(localJobId, template.html, {
        deepcopy_job_id: deepCopyJobId,
        name: template.name,
        type: template.type,
        created_at: new Date(template.timestamp)
      })
    }
    
    
    
  } catch (error) {
    console.error(`Error storing results for job ${localJobId}:`, error)
    throw error
  }
}

// Extract HTML templates from DeepCopy results
function extractHTMLTemplates(results: any): Array<{name: string, type: string, html: string, timestamp: string}> {
  const templates: Array<{name: string, type: string, html: string, timestamp: string}> = []
  
  try {
    // Handle different result structures
    if (results.templates && Array.isArray(results.templates)) {
      // Direct templates array
      results.templates.forEach((template: any, index: number) => {
        if (template.html) {
          templates.push({
            name: template.name || `Template ${index + 1}`,
            type: template.type || 'html',
            html: template.html,
            timestamp: template.timestamp || new Date().toISOString()
          })
        }
      })
    } else if (results.html) {
      // Single HTML result
      templates.push({
        name: 'Generated Content',
        type: 'html',
        html: results.html,
        timestamp: new Date().toISOString()
      })
    } else if (typeof results === 'string') {
      // String result
      templates.push({
        name: 'Generated Content',
        type: 'html',
        html: results,
        timestamp: new Date().toISOString()
      })
    } else if (results.content) {
      // Content field
      templates.push({
        name: 'Generated Content',
        type: 'html',
        html: results.content,
        timestamp: new Date().toISOString()
      })
    } else {
      // Try to find HTML in various possible locations
      const possibleKeys = ['output', 'result', 'generated', 'copy', 'text', 'body']
      for (const key of possibleKeys) {
        if (results[key] && typeof results[key] === 'string') {
          templates.push({
            name: `Generated Content (${key})`,
            type: 'html',
            html: results[key],
            timestamp: new Date().toISOString()
          })
          break
        }
      }
    }
    
    // If still no templates found, try to extract from nested objects
    if (templates.length === 0) {
      const extractFromObject = (obj: any, path: string = ''): void => {
        if (typeof obj === 'object' && obj !== null) {
          for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key
            if (typeof value === 'string' && value.includes('<')) {
              templates.push({
                name: `Generated Content (${currentPath})`,
                type: 'html',
                html: value,
                timestamp: new Date().toISOString()
              })
            } else if (typeof value === 'object') {
              extractFromObject(value, currentPath)
            }
          }
        }
      }
      
      extractFromObject(results)
    }
    
  } catch (error) {
    console.error('Error extracting HTML templates:', error)
  }
  
  return templates
}
