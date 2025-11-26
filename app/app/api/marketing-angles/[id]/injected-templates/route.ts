import { NextRequest, NextResponse } from 'next/server'
import { getInjectedTemplatesByJob } from '@/lib/db/queries'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const marketingAngleId = params.id

    if (!marketingAngleId) {
      return NextResponse.json(
        { error: 'Marketing angle ID is required' },
        { status: 400 }
      )
    }

    const injectedTemplates = await getInjectedTemplatesByJob(marketingAngleId)

    return NextResponse.json(injectedTemplates)
  } catch (error) {
    console.error('Error fetching injected templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch injected templates' },
      { status: 500 }
    )
  }
}
