import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    // Test database connection
    const result = await query('SELECT COUNT(*) as count FROM jobs WHERE status = $1', ['completed'])
    
    return NextResponse.json({
      success: true,
      message: 'Migration endpoint is working',
      completedJobs: result.rows[0].count
    })
  } catch (error) {
    console.error('Migration test failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Migration test failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting migration of existing jobs...')
    
    // Get all completed jobs with results
    const jobs = await query(`
      SELECT j.*, r.metadata, r.html_content as result_html_content
      FROM jobs j
      LEFT JOIN results r ON j.id = r.job_id
      WHERE j.status = 'completed' AND r.metadata IS NOT NULL
      ORDER BY j.created_at DESC
    `)
    
    console.log(`📊 Found ${jobs.rows.length} completed jobs to migrate`)
    
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
    
    let successCount = 0
    let errorCount = 0
    const results = []
    
    for (const job of jobs.rows) {
      try {
        console.log(`\n🔄 Processing job: ${job.id} - ${job.title}`)
        console.log(`   Template ID: ${job.template_id}`)
        console.log(`   Advertorial Type: ${job.advertorial_type}`)
        
        const apiResult = job.metadata
        // Look for swipe_results in the correct location
        const swipeResults = apiResult.swipe_results || 
                            apiResult.full_result?.results?.swipe_results || 
                            apiResult.full_result?.swipe_results ||
                            []
        
        if (!swipeResults || !Array.isArray(swipeResults) || swipeResults.length === 0) {
          console.log(`   ❌ No swipe_results found`)
          errorCount++
          results.push({
            jobId: job.id,
            jobTitle: job.title,
            status: 'failed',
            reason: 'No swipe_results found'
          })
          continue
        }
        
        // Extract angles from swipe results
        const angles = swipeResults.map((swipe, index) => {
          if (swipe && typeof swipe === 'object') {
            return swipe.angle || swipe.angle_name || `Angle ${index + 1}`
          }
          return `Angle ${index + 1}`
        })
        
        console.log(`   📐 Found ${angles.length} angles`)
        
        // Get the correct injectable template for this job
        const injectableTemplate = await getInjectableTemplateForJob(job)
        
        if (!injectableTemplate) {
          console.log(`   ❌ No injectable template found`)
          errorCount++
          results.push({
            jobId: job.id,
            jobTitle: job.title,
            status: 'failed',
            reason: 'No injectable template found'
          })
          continue
        }
        
        console.log(`   ✅ Found injectable template: ${injectableTemplate.id} (${injectableTemplate.name})`)
        
        // Clear any existing injected templates for this job
        await query('DELETE FROM injected_templates WHERE job_id = $1', [job.id])
        
        // Process each angle
        const injectedTemplates = []
        for (let i = 0; i < angles.length; i++) {
          const angle = angles[i]
          const swipeResult = swipeResults[i]
          
          if (swipeResult) {
            try {
              console.log(`   📝 Processing angle ${i + 1}: "${angle}"`)
              
              // Import template injection utilities
              const { extractContentFromSwipeResult, injectContentIntoTemplate } = await import('@/lib/utils/template-injection')
              
              // Extract content from swipe result
              const contentData = extractContentFromSwipeResult(swipeResult, job.advertorial_type)
              
              // Inject content into template
              const injectedHtml = injectContentIntoTemplate(injectableTemplate, contentData)
              
              // Store the injected template
              await query(`
                INSERT INTO injected_templates (job_id, angle_index, angle_name, html_content, template_id)
                VALUES ($1, $2, $3, $4, $5)
              `, [job.id, i + 1, angle || `Angle ${i + 1}`, injectedHtml, injectableTemplate.id])
              
              injectedTemplates.push({
                angle: angle || `Angle ${i + 1}`,
                template: injectableTemplate.name
              })
              
              console.log(`   ✅ Generated template for "${angle}"`)
            } catch (error) {
              console.error(`   ❌ Error processing angle ${i + 1}:`, error.message)
            }
          }
        }
        
        if (injectedTemplates.length > 0) {
          console.log(`   🎉 Successfully generated ${injectedTemplates.length} templates:`)
          injectedTemplates.forEach((t, index) => {
            console.log(`      ${index + 1}. "${t.angle}" using ${t.template}`)
          })
          successCount++
          results.push({
            jobId: job.id,
            jobTitle: job.title,
            status: 'success',
            templateCount: injectedTemplates.length,
            templates: injectedTemplates
          })
        } else {
          console.log(`   ❌ No templates generated`)
          errorCount++
          results.push({
            jobId: job.id,
            jobTitle: job.title,
            status: 'failed',
            reason: 'No templates generated'
          })
        }
        
      } catch (error) {
        console.error(`❌ Error processing job ${job.id}:`, error.message)
        errorCount++
        results.push({
          jobId: job.id,
          jobTitle: job.title,
          status: 'error',
          reason: error.message
        })
      }
    }
    
    // Get template usage statistics
    const templateStats = await query(`
      SELECT 
        template_id,
        COUNT(*) as template_count,
        COUNT(DISTINCT job_id) as job_count
      FROM injected_templates 
      GROUP BY template_id
      ORDER BY template_count DESC
    `)
    
    const summary = {
      totalJobs: jobs.rows.length,
      successCount,
      errorCount,
      templateStats: templateStats.rows,
      results: results.slice(0, 10) // Return first 10 results for preview
    }
    
    console.log(`\n📊 Migration Summary:`)
    console.log(`   ✅ Successfully processed: ${successCount} jobs`)
    console.log(`   ❌ Failed: ${errorCount} jobs`)
    console.log(`   📈 Total jobs: ${jobs.rows.length}`)
    
    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      summary
    })
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Migration failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}

async function getInjectableTemplateForJob(job) {
  try {
    // First try to get by exact template_id match
    if (job.template_id) {
      const result = await query('SELECT * FROM injectable_templates WHERE id = $1', [job.template_id])
      if (result.rows.length > 0) {
        console.log(`   🎯 Found exact template match: ${result.rows[0].name}`)
        return result.rows[0]
      }
    }
    
    // Fallback to getting by advertorial_type
    const result = await query('SELECT * FROM injectable_templates WHERE advertorial_type = $1 ORDER BY created_at DESC LIMIT 1', [job.advertorial_type])
    if (result.rows.length > 0) {
      console.log(`   🔄 Using fallback template by type: ${result.rows[0].name}`)
      return result.rows[0]
    }
    
    console.log(`   ❌ No injectable template found for type: ${job.advertorial_type}`)
    return null
  } catch (error) {
    console.error('Error fetching injectable template:', error)
    return null
  }
}