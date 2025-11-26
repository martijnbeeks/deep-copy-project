import { NextRequest, NextResponse } from 'next/server'
import { getGeneratedAnglesForJob } from '@/lib/db/queries'

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

    const generatedAngles = await getGeneratedAnglesForJob(marketingAngleId)

    return NextResponse.json(generatedAngles)
  } catch (error) {
    console.error('Error fetching generated angles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch generated angles' },
      { status: 500 }
    )
  }
}
