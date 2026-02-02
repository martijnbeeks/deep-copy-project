import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { verifyAdminAuth, createAuthResponse } from '@/lib/auth/admin-auth'

// GET all templates
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const templates = await query(`
      SELECT id, name, description, category, created_at, updated_at,
             LENGTH(html_content) as content_length, html_content
      FROM templates 
      ORDER BY created_at DESC
    `)
    
    return NextResponse.json({ templates: templates.rows })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// POST upload new template
export async function POST(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const { id, name, description, category, htmlContent } = await request.json()
    
    if (!name || !htmlContent) {
      return NextResponse.json({ error: 'Name and HTML content are required' }, { status: 400 })
    }
    
    // Check if template already exists (by name or custom ID)
    const existingTemplate = await query('SELECT id FROM templates WHERE name = $1 OR id = $2', [name, id])
    if (existingTemplate.rows.length > 0) {
      return NextResponse.json({ error: 'Template with this name or ID already exists' }, { status: 400 })
    }
    
    // Create template with custom ID if provided
    const result = await query(`
      INSERT INTO templates (id, name, description, category, html_content) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING id, name, description, category, created_at
    `, [id || undefined, name, description || null, category || null, htmlContent])
    
    return NextResponse.json({ template: result.rows[0] })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}

// DELETE template
export async function DELETE(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('id')
    
    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }
    
    // Check if template is being used by any jobs
    const jobsUsingTemplate = await query(
      'SELECT COUNT(*) as count FROM jobs WHERE template_id = $1', 
      [templateId]
    )
    
    if (parseInt(jobsUsingTemplate.rows[0].count) > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete template that is being used by existing jobs' 
      }, { status: 400 })
    }
    
    // Delete template
    await query('DELETE FROM templates WHERE id = $1', [templateId])
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
