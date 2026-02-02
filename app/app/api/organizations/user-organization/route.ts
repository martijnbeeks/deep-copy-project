import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, getUserOrganizations } from '@/lib/db/queries'

// GET - Get user's primary organization (first organization they belong to)
export async function GET(request: NextRequest) {
  try {
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    const userEmail = authHeader?.replace('Bearer ', '') || null

    if (!userEmail) {
      return NextResponse.json({ organization: null })
    }

    const user = await getUserByEmail(userEmail)
    if (!user) {
      return NextResponse.json({ organization: null })
    }

    // Get user's organizations (approved members only)
    const organizations = await getUserOrganizations(user.id)

    // Return the first organization (most recently created)
    const organization = organizations.length > 0 ? organizations[0] : null

    return NextResponse.json({ organization })
  } catch (error) {
    console.error('Error fetching user organization:', error)
    return NextResponse.json({ organization: null })
  }
}

