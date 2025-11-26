import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Fetch injected templates for the job
    const result = await query(`
      SELECT 
        id,
        job_id,
        angle_index,
        angle_name,
        html_content,
        template_id,
        created_at
      FROM injected_templates 
      WHERE job_id = $1 
      ORDER BY angle_index ASC
    `, [jobId])

    return NextResponse.json({
      templates: result.rows,
      count: result.rows.length
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch injected templates' },
      { status: 500 }
    )
  }
}
