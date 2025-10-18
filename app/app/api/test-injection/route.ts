import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Testing template injection with one job...')
    
    // Get one completed job
    const jobs = await query(`
      SELECT j.id, j.title, j.template_id, j.advertorial_type, j.status,
             r.metadata
      FROM jobs j
      LEFT JOIN results r ON j.id = r.job_id
      WHERE j.status = 'completed' AND r.metadata IS NOT NULL
      LIMIT 1
    `)
    
    if (jobs.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No completed jobs found'
      })
    }
    
    const job = jobs.rows[0]
    console.log('Processing job:', job.id, job.title)
    
    // Parse metadata
    let metadata = {}
    try {
      metadata = typeof job.metadata === 'string' 
        ? JSON.parse(job.metadata) 
        : job.metadata
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse metadata'
      })
    }
    
    // Get swipe results
    const swipeResults = metadata.swipe_results || 
                        metadata.full_result?.results?.swipe_results || 
                        metadata.full_result?.swipe_results ||
                        []
    
    if (swipeResults.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No swipe results found'
      })
    }
    
    // Extract angles
    const angles = swipeResults.map((swipe, index) => {
      if (swipe && typeof swipe === 'object') {
        return swipe.angle || swipe.angle_name || `Angle ${index + 1}`
      }
      return `Angle ${index + 1}`
    })
    
    console.log('Found angles:', angles.length)
    
    // Get injectable template
    const injectableTemplates = await query(`
      SELECT * FROM injectable_templates 
      WHERE id = $1 OR advertorial_type = $2
      ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
      LIMIT 1
    `, [job.template_id, job.advertorial_type])
    
    if (injectableTemplates.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No injectable template found'
      })
    }
    
    const template = injectableTemplates.rows[0]
    console.log('Using template:', template.name)
    
    // Test injection with first angle
    const firstSwipeResult = swipeResults[0]
    const firstAngle = angles[0]
    
    try {
      // Import template injection utilities
      const { extractContentFromSwipeResult, injectContentIntoTemplate } = await import('@/lib/utils/template-injection')
      
      // Extract content from swipe result
      const contentData = extractContentFromSwipeResult(firstSwipeResult, job.advertorial_type)
      console.log('Content data extracted:', Object.keys(contentData))
      
      // Inject content into template
      const injectedHtml = injectContentIntoTemplate(template, contentData)
      console.log('Template injected successfully')
      
      // Store the test template
      await query(`
        INSERT INTO injected_templates (job_id, angle_index, angle_name, html_content, template_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [job.id, 1, firstAngle, injectedHtml, template.id])
      
      return NextResponse.json({
        success: true,
        message: 'Test injection successful',
        job: {
          id: job.id,
          title: job.title,
          template_id: job.template_id,
          advertorial_type: job.advertorial_type
        },
        template: {
          id: template.id,
          name: template.name
        },
        angle: firstAngle,
        contentDataKeys: Object.keys(contentData),
        injectedHtmlLength: injectedHtml.length
      })
      
    } catch (error) {
      console.error('Injection error:', error)
      return NextResponse.json({
        success: false,
        error: 'Injection failed',
        details: error.message
      })
    }
    
  } catch (error) {
    console.error('Test failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Test failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
