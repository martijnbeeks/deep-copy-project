import { NextRequest, NextResponse } from 'next/server'
import { getInjectedTemplatesByJob } from '@/lib/db/queries'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const injectedTemplates = await getInjectedTemplatesByJob(jobId)

    return NextResponse.json(injectedTemplates)
  } catch (error) {
    console.error('Error fetching injected templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch injected templates' },
      { status: 500 }
    )
  }
}

