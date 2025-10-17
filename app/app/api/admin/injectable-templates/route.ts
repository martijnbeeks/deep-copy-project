import { NextRequest, NextResponse } from 'next/server'
import { 
  getInjectableTemplates, 
  getInjectableTemplateById,
  createInjectableTemplate, 
  updateInjectableTemplate,
  deleteInjectableTemplate 
} from '@/lib/db/queries'
import { verifyAdminAuth, createAuthResponse } from '@/lib/auth/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'listicle' | 'advertorial' | null
    const id = searchParams.get('id')

    let templates
    if (id) {
      // Fetch specific template by ID
      templates = await getInjectableTemplateById(id)
    } else {
      // Fetch templates by type
      templates = await getInjectableTemplates(type)
    }
    
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error fetching injectable templates:', error)
    return NextResponse.json({ error: 'Failed to fetch injectable templates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const body = await request.json()
    const { id, name, type, htmlContent, description } = body

    if (!name || !type || !htmlContent) {
      return NextResponse.json({ error: 'Name, type, and HTML content are required' }, { status: 400 })
    }

    if (!['listicle', 'advertorial'].includes(type)) {
      return NextResponse.json({ error: 'Type must be either "listicle" or "advertorial"' }, { status: 400 })
    }

    const template = await createInjectableTemplate(name, type, htmlContent, description, id)
    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error creating injectable template:', error)
    return NextResponse.json({ error: 'Failed to create injectable template' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const body = await request.json()
    const { id, name, type, htmlContent, description, is_active } = body

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }

    if (!name || !type || !htmlContent) {
      return NextResponse.json({ error: 'Name, type, and HTML content are required' }, { status: 400 })
    }

    if (!['listicle', 'advertorial'].includes(type)) {
      return NextResponse.json({ error: 'Type must be either "listicle" or "advertorial"' }, { status: 400 })
    }

    const template = await updateInjectableTemplate(id, {
      name,
      html_content: htmlContent,
      description,
      is_active: is_active !== undefined ? is_active : true
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error updating injectable template:', error)
    return NextResponse.json({ error: 'Failed to update injectable template' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
  }

  try {
    const success = await deleteInjectableTemplate(id)
    if (!success) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Injectable template deleted successfully' })
  } catch (error) {
    console.error('Error deleting injectable template:', error)
    return NextResponse.json({ error: 'Failed to delete injectable template' }, { status: 500 })
  }
}
