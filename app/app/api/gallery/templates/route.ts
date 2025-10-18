import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const userEmail = authHeader?.replace('Bearer ', '') || 'demo@example.com'
    
    const { getUserByEmail } = await import('@/lib/db/queries')
    const user = await getUserByEmail(userEmail)
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '6')
    const offset = (page - 1) * limit

    // Get templates directly from injected_templates table with pagination
    const templatesResult = await query(`
      SELECT 
        it.id,
        it.job_id,
        it.angle_index,
        it.angle_name,
        it.html_content,
        it.template_id,
        it.created_at,
        j.title as job_title,
        j.status as job_status,
        j.advertorial_type,
        j.created_at as job_created_at,
        t.name as template_name
      FROM injected_templates it
      JOIN jobs j ON it.job_id = j.id
      LEFT JOIN templates t ON j.template_id = t.id
      WHERE j.user_id = $1
      ORDER BY it.created_at DESC
      LIMIT $2 OFFSET $3
    `, [user.id, limit, offset])

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM injected_templates it
      JOIN jobs j ON it.job_id = j.id
      WHERE j.user_id = $1
    `, [user.id])

    const total = parseInt(countResult.rows[0].total)
    const hasMore = offset + limit < total

    // Transform to gallery format
    const templates = templatesResult.rows.map(row => ({
      id: `${row.job_id}-${row.angle_index}`,
      jobId: row.job_id,
      jobTitle: row.job_title,
      templateName: row.template_name || 'Unknown Template',
      angle: row.angle_name,
      html: row.html_content,
      createdAt: row.job_created_at,
      status: row.job_status,
      advertorialType: row.advertorial_type || 'unknown',
      thumbnail: generateThumbnail(row.html_content)
    }))

    return NextResponse.json({ 
      templates,
      total,
      hasMore,
      page,
      limit
    })
  } catch (error) {
    console.error('Error fetching gallery templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// Simple thumbnail generator
function generateThumbnail(html: string): string {
  // Extract first image or return a placeholder
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
  if (imgMatch) {
    return imgMatch[1]
  }
  return 'https://placehold.co/300x200?text=Template+Preview'
}
