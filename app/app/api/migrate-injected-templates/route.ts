import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting migration of existing jobs to generate injected templates...')
    
    // Get all completed jobs that don't have injected templates yet
    const jobs = await query(`
      SELECT j.*, r.metadata
      FROM jobs j
      LEFT JOIN results r ON j.id = r.job_id
      LEFT JOIN injected_templates it ON j.id = it.job_id
      WHERE j.status = 'completed' 
        AND r.metadata IS NOT NULL 
        AND it.job_id IS NULL
      ORDER BY j.created_at DESC
    `)
    
    console.log(`📊 Found ${jobs.rows.length} completed jobs without injected templates`)
    
    let successCount = 0
    let errorCount = 0
    
    for (const job of jobs.rows) {
      try {
        console.log(`Processing job ${job.id}...`)
        console.log(`Job title: ${job.title}`)
        console.log(`Job template_id: ${job.template_id}`)
        console.log(`Job advertorial_type: ${job.advertorial_type}`)
        
        // Parse the metadata to get the full result
        const metadata = typeof job.metadata === 'string' 
          ? JSON.parse(job.metadata) 
          : job.metadata
        
        const fullResult = metadata.full_result || metadata
        console.log(`Full result keys: ${Object.keys(fullResult).join(', ')}`)
        
        // Check if we have swipe_results
        let swipeResults = fullResult.results?.swipe_results || 
                          fullResult.swipe_results || 
                          []
        
        // If swipeResults is an object, convert it to an array
        if (swipeResults && typeof swipeResults === 'object' && !Array.isArray(swipeResults)) {
          swipeResults = Object.values(swipeResults)
        }
        
        console.log(`Swipe results found: ${swipeResults.length}`)
        console.log(`Swipe results type: ${typeof swipeResults}`)
        
        if (!swipeResults || !Array.isArray(swipeResults) || swipeResults.length === 0) {
          console.log(`No swipe_results found for job ${job.id}`)
          console.log(`Available keys in fullResult: ${Object.keys(fullResult).join(', ')}`)
          if (fullResult.results) {
            console.log(`Available keys in fullResult.results: ${Object.keys(fullResult.results).join(', ')}`)
          }
          continue
        }
        
        // Get the injectable template
        const injectableTemplate = await getInjectableTemplateForJob(job)
        
        console.log(`Injectable template found: ${injectableTemplate ? 'Yes' : 'No'}`)
        if (injectableTemplate) {
          console.log(`Injectable template ID: ${injectableTemplate.id}`)
        }
        
        if (!injectableTemplate) {
          console.log(`No injectable template found for job ${job.id}`)
          console.log(`Template ID: ${job.template_id}`)
          console.log(`Advertorial Type: ${job.advertorial_type}`)
          continue
        }
        
        // Extract angles from swipe results
        const angles = swipeResults.map((swipe, index) => {
          if (swipe && typeof swipe === 'object') {
            return swipe.angle || swipe.angle_name || `Angle ${index + 1}`
          }
          return `Angle ${index + 1}`
        })
        
        // Process each angle
        for (let i = 0; i < angles.length; i++) {
          const angle = angles[i]
          const swipeResult = swipeResults[i]
          
          if (swipeResult) {
            try {
              // Import template injection utilities
              const { extractContentFromSwipeResult, injectContentIntoTemplate } = await import('@/lib/utils/template-injection')
              
              // Extract content from swipe result
              const contentData = extractContentFromSwipeResult(swipeResult, job.advertorial_type)
              
              // Inject content into template
              const injectedHtml = injectContentIntoTemplate(injectableTemplate.html_content, contentData)
              
              // Store the injected template
              await query(`
                INSERT INTO injected_templates (job_id, angle_index, angle_name, html_content, template_id)
                VALUES ($1, $2, $3, $4, $5)
              `, [job.id, i + 1, angle || `Angle ${i + 1}`, injectedHtml, job.template_id])
              
              console.log(`✅ Generated injected template for angle ${i + 1}: ${angle}`)
            } catch (error) {
              console.error(`Error generating injected template for angle ${i + 1}:`, error)
            }
          }
        }
        
        successCount++
        console.log(`✅ Successfully processed job ${job.id}`)
        
      } catch (error) {
        errorCount++
        console.error(`❌ Error processing job ${job.id}:`, error)
      }
    }
    
    return NextResponse.json({
      message: 'Migration completed',
      successCount,
      errorCount,
      totalJobs: jobs.rows.length
    })
    
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Migration failed' },
      { status: 500 }
    )
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
