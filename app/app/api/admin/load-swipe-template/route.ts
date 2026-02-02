import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { verifyAdminAuth, createAuthResponse } from '@/lib/auth/admin-auth'

const SWIPE_TEMPLATES = {
  'blissy': { file: 'blissy.html', type: 'listicle', name: 'Blissy Listicle Template' },
  'javycoffee': { file: 'javycoffee.html', type: 'listicle', name: 'Javy Coffee Listicle Template' },
  'hike': { file: 'hike.html', type: 'listicle', name: 'Hike Listicle Template' },
  'bugmd': { file: 'bugmd.html', type: 'advertorial', name: 'BugMD Advertorial Template' },
  'bunion': { file: 'bunion.html', type: 'advertorial', name: 'Bunion Fix Advertorial Template' },
  'footpads': { file: 'footpads.html', type: 'advertorial', name: 'Footpads Advertorial Template' },
  'example': { file: 'example_with_placeholders.html', type: 'advertorial', name: 'Example Advertorial Template' }
}

export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  const { searchParams } = new URL(request.url)
  const templateName = searchParams.get('template')

  if (!templateName || !SWIPE_TEMPLATES[templateName as keyof typeof SWIPE_TEMPLATES]) {
    return NextResponse.json({ error: 'Invalid template name' }, { status: 400 })
  }

  try {
    const templateInfo = SWIPE_TEMPLATES[templateName as keyof typeof SWIPE_TEMPLATES]
    const filePath = join(process.cwd(), 'swipe_templates', templateInfo.file)
    
    const htmlContent = await readFile(filePath, 'utf-8')
    
    return NextResponse.json({
      htmlContent,
      name: templateInfo.name,
      type: templateInfo.type,
      description: `Swipe template for ${templateInfo.type} - ${templateInfo.name}`
    })
  } catch (error) {
    console.error('Error loading swipe template:', error)
    return NextResponse.json({ error: 'Failed to load template' }, { status: 500 })
  }
}
