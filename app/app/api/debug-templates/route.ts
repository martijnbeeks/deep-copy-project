import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }
    
    console.log(`🔍 Debugging template injection for job: ${jobId}`)
    
    // Check if job exists
    const jobResult = await query(`
      SELECT id, title, status, template_id, advertorial_type, created_at
      FROM jobs 
      WHERE id = $1
    `, [jobId])
    
    if (jobResult.rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    
    const job = jobResult.rows[0]
    console.log(`📊 Job found:`, job)
    
    // Check if injectable template exists
    const templateResult = await query(`
      SELECT id, name, advertorial_type
      FROM injectable_templates 
      WHERE id = $1
    `, [job.template_id])
    
    if (templateResult.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Injectable template not found',
        job,
        availableTemplates: await getAvailableTemplates()
      }, { status: 404 })
    }
    
    const template = templateResult.rows[0]
    console.log(`📊 Template found:`, template)
    
    // Check if injected templates exist
    const injectedResult = await query(`
      SELECT COUNT(*) as count, 
             array_agg(angle_name) as angles
      FROM injected_templates 
      WHERE job_id = $1
    `, [jobId])
    
    const injectedCount = parseInt(injectedResult.rows[0].count)
    const injectedAngles = injectedResult.rows[0].angles || []
    
    console.log(`📊 Injected templates: ${injectedCount} found`)
    
    return NextResponse.json({
      job,
      template,
      injectedTemplates: {
        count: injectedCount,
        angles: injectedAngles
      },
      debug: {
        jobStatus: job.status,
        templateId: job.template_id,
        advertorialType: job.advertorial_type
      }
    })
    
  } catch (error) {
    console.error('❌ Debug error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function getAvailableTemplates() {
  const result = await query(`
    SELECT id, name, advertorial_type
    FROM injectable_templates 
    ORDER BY id
  `)
  return result.rows
}
