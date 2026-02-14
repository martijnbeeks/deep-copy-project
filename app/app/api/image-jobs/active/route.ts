import { NextResponse } from 'next/server'
import { recoverPendingImageJobs } from '@/lib/services/server-image-polling'

export async function GET() {
  try {
    // Check for pending jobs and start polling them to completion (fire-and-forget)
    const activeTemplateIds = await recoverPendingImageJobs()

    return NextResponse.json({ activeTemplateIds })
  } catch (error) {
    // Table might not exist yet - return empty
    return NextResponse.json({ activeTemplateIds: [] })
  }
}
