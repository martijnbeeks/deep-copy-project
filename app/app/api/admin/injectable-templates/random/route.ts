import { NextRequest, NextResponse } from 'next/server'
import { getRandomInjectableTemplate } from '@/lib/db/queries'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'listicle' | 'advertorial' | null

    if (!type) {
      return NextResponse.json({ error: 'Type parameter is required' }, { status: 400 })
    }

    if (!['listicle', 'advertorial'].includes(type)) {
      return NextResponse.json({ error: 'Type must be either "listicle" or "advertorial"' }, { status: 400 })
    }

    const template = await getRandomInjectableTemplate(type)
    
    if (!template) {
      return NextResponse.json({ error: `No ${type} template found` }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error fetching random injectable template:', error)
    return NextResponse.json({ error: 'Failed to fetch random template' }, { status: 500 })
  }
}
