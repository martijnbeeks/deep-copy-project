import { NextRequest, NextResponse } from 'next/server'
import { getJobsByUserIdWithResults } from '@/lib/db/queries'

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
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '6')

    // Calculate offset for pagination
    const offset = (page - 1) * limit

    const jobs = await getJobsByUserIdWithResults(user.id, { status, search, page, limit, offset })

    // Get total count for pagination
    const { query } = await import('@/lib/db/connection')
    let countQuery = 'SELECT COUNT(*) FROM jobs WHERE user_id = $1'
    const countParams = [user.id]
    
    if (status) {
      countQuery += ' AND status = $2'
      countParams.push(status)
    }
    
    if (search) {
      const searchParam = countParams.length + 1
      countQuery += ` AND (title ILIKE $${searchParam} OR brand_info ILIKE $${searchParam})`
      countParams.push(`%${search}%`)
    }

    const countResult = await query(countQuery, countParams)
    const total = parseInt(countResult.rows[0].count)
    const hasMore = offset + limit < total

    return NextResponse.json({ 
      jobs, 
      total, 
      hasMore,
      page,
      limit 
    })
  } catch (error) {
    console.error('Error fetching jobs with results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs with results' },
      { status: 500 }
    )
  }
}
