import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Get the injected template by ID
    const result = await query(
      'SELECT * FROM injected_templates WHERE id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    const template = result.rows[0]

    // Get swipe file name if template_id exists
    let swipe_file_name = null
    if (template.template_id) {
      try {
        const templateIdParam = String(template.template_id).trim()
        const nameResult = await query(
          'SELECT name FROM injectable_templates WHERE id::text = $1::text',
          [templateIdParam]
        )
        
        if (nameResult.rows.length > 0) {
          swipe_file_name = nameResult.rows[0].name
        }
      } catch (error) {
        console.error(`Error fetching swipe_file_name:`, error)
      }
    }

    return NextResponse.json({
      ...template,
      swipe_file_name
    })

  } catch (error) {
    console.error('Error fetching injected template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
