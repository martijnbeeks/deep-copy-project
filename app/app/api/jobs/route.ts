import { NextRequest, NextResponse } from 'next/server'
import { getJobsByUserId, createJob, updateJobStatus, createResult } from '@/lib/db/queries'
import { deepCopyClient } from '@/lib/api/deepcopy-client'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const userEmail = authHeader?.replace('Bearer ', '') || 'demo@example.com'
    
    const { getUserByEmail } = await import('@/lib/db/queries')
    const user = await getUserByEmail(userEmail)
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined

    const jobs = await getJobsByUserId(user.id, { status, search })

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Jobs fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, brand_info, sales_page_url, template_id } = await request.json()

    if (!title || !brand_info) {
      return NextResponse.json(
        { error: 'Title and brand info are required' },
        { status: 400 }
      )
    }

    const authHeader = request.headers.get('authorization')
    const userEmail = authHeader?.replace('Bearer ', '') || 'demo@example.com'
    
    const { getUserByEmail } = await import('@/lib/db/queries')
    const user = await getUserByEmail(userEmail)
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Submit job to DeepCopy API first to get the job ID
    let deepCopyJobId: string
    try {
      console.log('Submitting job to DeepCopy API:', {
        sales_page_url: sales_page_url || '',
        project_name: title,
        swipe_file_id: 'L00005',
        advertorial_type: 'Listicle'
      })

      const deepCopyResponse = await deepCopyClient.submitJob({
        sales_page_url: sales_page_url || '',
        project_name: title,
        swipe_file_id: 'L00005', // Hardcoded as requested
        advertorial_type: 'Listicle' // Default type
      })

      console.log('DeepCopy API response:', deepCopyResponse)
      deepCopyJobId = deepCopyResponse.jobId

    } catch (apiError) {
      console.error('DeepCopy API error:', apiError)
      console.error('API error details:', {
        message: apiError instanceof Error ? apiError.message : 'Unknown error',
        stack: apiError instanceof Error ? apiError.stack : undefined
      })
      return NextResponse.json(
        { error: 'Failed to submit job to DeepCopy API' },
        { status: 500 }
      )
    }

    // Create job in database with the DeepCopy job ID as the primary ID
    const job = await createJob({
      user_id: user.id,
      title,
      brand_info,
      sales_page_url,
      template_id,
      execution_id: deepCopyJobId,
      custom_id: deepCopyJobId // Use DeepCopy job ID as the primary key
    })

    // Update job status to processing
    await updateJobStatus(job.id, 'processing')

    // Immediately check the job status to get initial progress
    try {
      console.log(`🔍 Checking initial status for job ${job.id}`)
      const statusResponse = await deepCopyClient.getJobStatus(deepCopyJobId)
      console.log(`📊 Initial DeepCopy API response for job ${job.id}:`, statusResponse)
      
      if (statusResponse.status === 'SUCCEEDED') {
        // Job completed immediately - get results and store them
        console.log(`✅ Job ${job.id} completed immediately, fetching results...`)
        const result = await deepCopyClient.getJobResult(deepCopyJobId)
        await storeJobResults(job.id, result, deepCopyJobId)
        await updateJobStatus(job.id, 'completed', 100)
        console.log(`✅ Job ${job.id} marked as completed`)
        
      } else if (statusResponse.status === 'FAILED') {
        // Job failed immediately
        await updateJobStatus(job.id, 'failed')
        console.log(`❌ Job ${job.id} failed immediately`)
        
      } else if (['RUNNING', 'SUBMITTED', 'PENDING'].includes(statusResponse.status)) {
        // Job is processing - update progress
        const progress = statusResponse.status === 'SUBMITTED' ? 25 : 
                       statusResponse.status === 'RUNNING' ? 50 : 30
        await updateJobStatus(job.id, 'processing', progress)
        console.log(`🔄 Job ${job.id} is processing (${statusResponse.status}) - cron will handle updates`)
      }
    } catch (statusError) {
      console.error(`Error checking initial status for job ${job.id}:`, statusError)
      // Continue with job creation even if status check fails
    }

    console.log(`Job ${job.id} created with DeepCopy ID: ${deepCopyJobId} - cron will handle status updates`)

    return NextResponse.json(job)
  } catch (error) {
    console.error('Job creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    )
  }
}

// Store job results in database
async function storeJobResults(localJobId: string, result: any, deepCopyJobId: string) {
  try {
    console.log(`💾 Storing results for job ${localJobId}`)
    
    // Extract HTML templates from the result
    const templates = extractHTMLTemplates(result)
    
    if (templates.length === 0) {
      console.log(`⚠️ No templates found in result for job ${localJobId}`)
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
    
    console.log(`✅ Stored ${templates.length} templates for job ${localJobId}`)
    
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
