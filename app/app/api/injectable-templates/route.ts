import { NextRequest, NextResponse } from 'next/server'
import { getInjectableTemplates } from '@/lib/db/queries'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'listicle' | 'advertorial' | null

    const templates = await getInjectableTemplates(type || undefined)
    
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching injectable templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch injectable templates' },
      { status: 500 }
    )
  }
}

