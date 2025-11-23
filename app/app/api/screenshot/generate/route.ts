export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { generateScreenshot } from '@/lib/utils/screenshot'

export async function POST(request: NextRequest) {
    try {
        const { jobId, url } = await request.json()

        if (!jobId || !url) {
            return NextResponse.json(
                { error: 'Job ID and URL are required' },
                { status: 400 }
            )
        }

        // Generate screenshot asynchronously
        await generateScreenshot(jobId, url)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Screenshot generation error:', error)
        return NextResponse.json(
            {
                error: 'Failed to generate screenshot',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        )
    }
}

