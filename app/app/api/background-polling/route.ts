import { NextRequest, NextResponse } from 'next/server'
import { backgroundPollingService } from '@/lib/services/background-polling'

export async function GET(request: NextRequest) {
  try {
    const status = backgroundPollingService.getStatus()
    
    return NextResponse.json({
      success: true,
      ...status
    })
    
  } catch (error) {
    console.error('Error getting background polling status:', error)
    return NextResponse.json(
      { error: 'Failed to get background polling status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    if (action === 'start') {
      backgroundPollingService.start()
      return NextResponse.json({ success: true, message: 'Background polling started' })
    } else if (action === 'stop') {
      backgroundPollingService.stop()
      return NextResponse.json({ success: true, message: 'Background polling stopped' })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Error controlling background polling:', error)
    return NextResponse.json(
      { error: 'Failed to control background polling' },
      { status: 500 }
    )
  }
}
