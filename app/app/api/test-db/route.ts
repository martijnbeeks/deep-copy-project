import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    // Simple test query
    const result = await query('SELECT 1 as test')
    
    return NextResponse.json({
      success: true,
      message: 'Database connection working',
      test: result.rows[0]
    })
  } catch (error) {
    console.error('Database test failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database test failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
