import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing database connection...')
    
    // Test basic connection
    const timeResult = await query('SELECT NOW() as current_time')
    console.log('Database connected:', timeResult.rows[0])
    
    // Test users table
    const usersResult = await query('SELECT COUNT(*) as count FROM users')
    console.log('Users count:', usersResult.rows[0])
    
    // Test templates table
    const templatesResult = await query('SELECT COUNT(*) as count FROM templates')
    console.log('Templates count:', templatesResult.rows[0])
    
    // Test jobs table
    const jobsResult = await query('SELECT COUNT(*) as count FROM jobs')
    console.log('Jobs count:', jobsResult.rows[0])
    
    // Check if demo user exists
    const demoUserResult = await query('SELECT id, email FROM users WHERE email = $1', ['demo@example.com'])
    console.log('Demo user:', demoUserResult.rows[0] || 'Not found')
    
    return NextResponse.json({
      status: 'success',
      database: {
        connected: true,
        current_time: timeResult.rows[0].current_time
      },
      counts: {
        users: usersResult.rows[0].count,
        templates: templatesResult.rows[0].count,
        jobs: jobsResult.rows[0].count
      },
      demo_user: demoUserResult.rows[0] || null
    })
    
  } catch (error) {
    console.error('Test failed:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
