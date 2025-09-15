import { NextRequest, NextResponse } from 'next/server'
import { getJobsByUserId, createJob } from '@/lib/db/queries'

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

    const jobs = await getJobsByUserId(user.id, { status, search })

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Jobs fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, brand_info, sales_page_url, template_id } = await request.json()

    if (!title || !brand_info) {
      return NextResponse.json(
        { error: 'Title and brand info are required' },
        { status: 400 }
      )
    }

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
    const job = await createJob({
      user_id: user.id,
      title,
      brand_info,
      sales_page_url,
      template_id
    })

    // Return job immediately, process in background
    return NextResponse.json(job)

    // Process job in background (this won't execute due to return above, but keeping for reference)
    // The processing will be handled by a separate endpoint or cron job
  } catch (error) {
    console.error('Job creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    )
  }
}
