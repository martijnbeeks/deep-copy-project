import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function DELETE(
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

    // Delete the injected template
    const result = await query(
      'DELETE FROM injected_templates WHERE id = $1 RETURNING *',
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      deleted: result.rows[0]
    })

  } catch (error) {
    console.error('❌ Error deleting template:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete template',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

