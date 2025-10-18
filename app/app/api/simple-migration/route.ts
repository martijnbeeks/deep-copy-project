import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting simple migration...')
    
    // Create injected_templates table
    await query(`
      CREATE TABLE IF NOT EXISTS injected_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        angle_index INTEGER NOT NULL,
        angle_name VARCHAR(255) NOT NULL,
        html_content TEXT NOT NULL,
        template_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    
    console.log('✅ Table created successfully')
    
    // Get one completed job to test with
    const jobs = await query(`
      SELECT j.id, j.title, j.template_id, j.advertorial_type,
             r.metadata
      FROM jobs j
      LEFT JOIN results r ON j.id = r.job_id
      WHERE j.status = 'completed' AND r.metadata IS NOT NULL
      LIMIT 1
    `)
    
    if (jobs.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No completed jobs found to migrate',
        migrated: 0
      })
    }
    
    const job = jobs.rows[0]
    console.log('Processing job:', job.id, job.title)
    
    // Get injectable template
    const injectableTemplates = await query(`
      SELECT * FROM injectable_templates 
      WHERE type = $1 
      LIMIT 1
    `, [job.advertorial_type])
    
    if (injectableTemplates.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No injectable template found for type: ' + job.advertorial_type
      })
    }
    
    const template = injectableTemplates.rows[0]
    console.log('Using template:', template.name)
    
    // Check if we have angles in metadata
    const apiResult = job.metadata
    if (!apiResult.angles || !Array.isArray(apiResult.angles)) {
      return NextResponse.json({
        success: false,
        message: 'No angles found in job metadata'
      })
    }
    
    console.log('Found angles:', apiResult.angles.length)
    
    // Insert test data for each angle
    let insertedCount = 0
    for (let i = 0; i < apiResult.angles.length; i++) {
      const angle = apiResult.angles[i]
      
      await query(`
        INSERT INTO injected_templates (job_id, angle_index, angle_name, html_content, template_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [job.id, i + 1, angle || `Angle ${i + 1}`, template.html_content, template.id])
      
      insertedCount++
      console.log(`Inserted template for angle ${i + 1}: ${angle}`)
    }
    
    return NextResponse.json({
      success: true,
      message: `Migration completed successfully`,
      migrated: insertedCount,
      jobId: job.id,
      angles: apiResult.angles
    })
    
  } catch (error) {
    console.error('❌ Simple migration failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Simple migration failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
