import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    // Check what tables exist
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)
    
    // Check if injectable_templates exists
    const injectableTemplatesExists = tables.rows.some(row => row.table_name === 'injectable_templates')
    
    // Check jobs table structure
    const jobsColumns = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      ORDER BY ordinal_position
    `)
    
    return NextResponse.json({
      success: true,
      tables: tables.rows.map(row => row.table_name),
      injectableTemplatesExists,
      jobsColumns: jobsColumns.rows
    })
    
  } catch (error) {
    console.error('Database structure check failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database structure check failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
