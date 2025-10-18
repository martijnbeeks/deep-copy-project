import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    // Check if injectable_templates table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'injectable_templates'
      )
    `)
    
    const tableExists = tableCheck.rows[0].exists
    
    if (!tableExists) {
      return NextResponse.json({
        success: false,
        message: 'injectable_templates table does not exist',
        tableExists: false
      })
    }
    
    // Get injectable templates count
    const countResult = await query('SELECT COUNT(*) as count FROM injectable_templates')
    const templateCount = countResult.rows[0].count
    
    // Get a few templates
    const templates = await query('SELECT id, name, type FROM injectable_templates LIMIT 5')
    
    return NextResponse.json({
      success: true,
      message: 'Injectable templates table exists',
      tableExists: true,
      templateCount: parseInt(templateCount),
      templates: templates.rows
    })
  } catch (error) {
    console.error('Table check failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Table check failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
