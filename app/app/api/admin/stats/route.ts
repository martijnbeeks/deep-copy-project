import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { verifyAdminAuth, createAuthResponse } from '@/lib/auth/admin-auth'

// GET database stats and current data
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    // Get counts for each table
    const [usersCount, templatesCount, jobsCount, resultsCount] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query('SELECT COUNT(*) as count FROM templates'),
      query('SELECT COUNT(*) as count FROM jobs'),
      query('SELECT COUNT(*) as count FROM results')
    ])
    
    // Get job status breakdown
    const jobStatuses = await query(`
      SELECT status, COUNT(*) as count 
      FROM jobs 
      GROUP BY status 
      ORDER BY count DESC
    `)
    
    // Get recent activity
    const recentJobs = await query(`
      SELECT j.id, j.title, j.status, j.created_at, u.email as user_email
      FROM jobs j
      JOIN users u ON j.user_id = u.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    
    // Get template categories
    const templateCategories = await query(`
      SELECT category, COUNT(*) as count 
      FROM templates 
      WHERE category IS NOT NULL
      GROUP BY category 
      ORDER BY count DESC
    `)
    
    return NextResponse.json({
      stats: {
        users: parseInt(usersCount.rows[0].count),
        templates: parseInt(templatesCount.rows[0].count),
        jobs: parseInt(jobsCount.rows[0].count),
        results: parseInt(resultsCount.rows[0].count)
      },
      jobStatuses: jobStatuses.rows,
      recentJobs: recentJobs.rows,
      templateCategories: templateCategories.rows
    })
  } catch (error) {
    console.error('Error fetching database stats:', error)
    return NextResponse.json({ error: 'Failed to fetch database stats' }, { status: 500 })
  }
}
