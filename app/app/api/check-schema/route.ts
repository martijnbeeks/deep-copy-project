import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    // Check injectable_templates table structure
    const columns = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'injectable_templates' 
      ORDER BY ordinal_position
    `)
    
    // Check jobs table structure
    const jobsColumns = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      ORDER BY ordinal_position
    `)
    
    return NextResponse.json({
      success: true,
      injectableTemplatesColumns: columns.rows,
      jobsColumns: jobsColumns.rows
    })
    
  } catch (error) {
    console.error('Schema check failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Schema check failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
