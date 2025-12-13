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

    // Step 1: Get all injected templates for this job
    const injectedTemplates = await query(`
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

    // Step 2: For each template, get the name from injectable_templates
    const result = await Promise.all(
      injectedTemplates.rows.map(async (row) => {
        let swipe_file_name = null
        
        if (row.template_id) {
          try {
            // Direct query for this specific template_id - cast both sides to text to ensure match
            const templateIdParam = String(row.template_id).trim()
            const nameResult = await query(`
              SELECT name 
              FROM injectable_templates 
              WHERE id::text = $1::text
            `, [templateIdParam])
            
            if (nameResult.rows.length > 0) {
              swipe_file_name = nameResult.rows[0].name
            }
          } catch (queryError) {
            console.error(`❌ [SERVER] Error querying injectable_templates for id="${row.template_id}":`, queryError)
          }
        }
        
        return {
          ...row,
          swipe_file_name
        }
      })
    )

    return NextResponse.json({
      templates: result,
      count: result.length
    })

  } catch (error) {
    console.error('❌ Error in /api/templates/injected:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch injected templates',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
