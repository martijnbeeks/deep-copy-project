import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { extractContentFromSwipeResult, injectContentIntoTemplate } from '@/lib/utils/template-injection'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const userEmail = authHeader?.replace('Bearer ', '') || 'demo@example.com'

    const { getUserByEmail } = await import('@/lib/db/queries')
    const user = await getUserByEmail(userEmail)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '6')
    const offset = (page - 1) * limit

    // Get completed jobs with their results metadata
    const jobsResult = await query(`
      SELECT 
        j.id,
        j.title,
        j.status,
        j.advertorial_type,
        j.template_id,
        j.created_at,
        r.metadata,
        t.name as template_name
      FROM jobs j
      LEFT JOIN results r ON j.id = r.job_id
      LEFT JOIN templates t ON j.template_id = t.id
      WHERE j.user_id = $1 
        AND j.status = 'completed' 
        AND r.metadata IS NOT NULL
      ORDER BY j.created_at DESC
      LIMIT $2 OFFSET $3
    `, [user.id, limit, offset])

    // Get total count of completed jobs
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM jobs j
      LEFT JOIN results r ON j.id = r.job_id
      WHERE j.user_id = $1 
        AND j.status = 'completed' 
        AND r.metadata IS NOT NULL
    `, [user.id])

    const total = parseInt(countResult.rows[0].total)
    const hasMore = offset + limit < total

    // Process each job to generate templates dynamically
    const templates = []

    // First try to get templates from injected_templates table as fallback
    const fallbackTemplates = await query(`
      SELECT 
        it.id,
        it.job_id,
        it.angle_index,
        it.angle_name,
        it.html_content,
        it.template_id,
        it.created_at,
        j.title as job_title,
        j.status as job_status,
        j.advertorial_type,
        j.created_at as job_created_at,
        t.name as template_name
      FROM injected_templates it
      JOIN jobs j ON it.job_id = j.id
      LEFT JOIN templates t ON j.template_id = t.id
      WHERE j.user_id = $1
      ORDER BY it.created_at DESC
      LIMIT $2 OFFSET $3
    `, [user.id, limit, offset])

    // If we have fallback templates, use them
    if (fallbackTemplates.rows.length > 0) {
      console.log(`📦 Using ${fallbackTemplates.rows.length} templates from injected_templates table`)

      const fallbackTemplatesFormatted = fallbackTemplates.rows.map(row => ({
        id: `${row.job_id}-${row.angle_index}`,
        jobId: row.job_id,
        jobTitle: row.job_title,
        templateName: row.template_name || 'Unknown Template',
        angle: row.angle_name,
        html: row.html_content,
        createdAt: row.job_created_at,
        status: row.job_status,
        advertorialType: row.advertorial_type || 'unknown',
        thumbnail: generateThumbnail(row.html_content)
      }))

      return NextResponse.json({
        templates: fallbackTemplatesFormatted,
        total,
        hasMore,
        page,
        limit,
        source: 'injected_templates_table' // Add source indicator for debugging
      })
    }

    // Otherwise, generate templates dynamically
    console.log(`🔄 Generating templates dynamically for ${jobsResult.rows.length} jobs`)

    for (const job of jobsResult.rows) {
      try {
        console.log(`🔍 Processing job ${job.id}: ${job.title}`)

        const metadata = job.metadata
        const fullResult = metadata?.full_result

        if (!fullResult || !fullResult.results?.swipe_results) {
          console.log(`⚠️ Job ${job.id} has no swipe_results, skipping`)
          continue
        }

        const swipeResults = fullResult.results.swipe_results
        console.log(`📊 Found ${swipeResults.length} swipe results for job ${job.id}`)

        // Get injectable template for this job
        const templateType = job.advertorial_type === 'listicle' ? 'listicle' : 'advertorial'

        let injectableTemplate = null

        if (job.template_id) {
          // Try to fetch the specific injectable template with the same ID
          console.log(`🔍 Looking for injectable template with ID: ${job.template_id}`)
          const specificResponse = await query(`
            SELECT * FROM injectable_templates WHERE id = $1
          `, [job.template_id])

          if (specificResponse.rows.length > 0) {
            injectableTemplate = specificResponse.rows[0]
            console.log(`✅ Found specific injectable template: ${injectableTemplate.name}`)
          }
        }

        // Fallback: fetch by type if specific template not found
        if (!injectableTemplate) {
          console.log(`⚠️ Specific template not found, fetching by type: ${templateType}`)
          const typeResponse = await query(`
            SELECT * FROM injectable_templates WHERE advertorial_type = $1 LIMIT 1
          `, [templateType])

          if (typeResponse.rows.length > 0) {
            injectableTemplate = typeResponse.rows[0]
            console.log(`✅ Using fallback injectable template: ${injectableTemplate.name}`)
          }
        }

        if (!injectableTemplate) {
          console.log(`⚠️ No injectable template found for job ${job.id}, skipping`)
          continue
        }

        // Process each swipe result to create templates
        swipeResults.forEach((swipeResult, index) => {
          try {
            // Extract content from the individual swipe result
            const contentData = extractContentFromSwipeResult(swipeResult, templateType)

            // Inject content into the injectable template
            const renderedHtml = injectContentIntoTemplate(injectableTemplate, contentData)

            templates.push({
              id: `${job.id}-${index + 1}`,
              jobId: job.id,
              jobTitle: job.title,
              templateName: job.template_name || injectableTemplate.name || 'Unknown Template',
              angle: swipeResult.angle || `Angle ${index + 1}`,
              html: renderedHtml,
              createdAt: job.created_at,
              status: job.status,
              advertorialType: job.advertorial_type || 'unknown',
              thumbnail: generateThumbnail(renderedHtml)
            })

            console.log(`✅ Generated template for angle ${index + 1}: ${swipeResult.angle}`)
          } catch (error) {
            console.error(`❌ Error processing angle ${index + 1} for job ${job.id}:`, error)
          }
        })

      } catch (error) {
        console.error(`❌ Error processing job ${job.id}:`, error)
      }
    }

    console.log(`🎉 Generated ${templates.length} templates from ${jobsResult.rows.length} jobs`)

    return NextResponse.json({
      templates,
      total,
      hasMore,
      page,
      limit,
      source: 'dynamic_generation' // Add source indicator for debugging
    })
  } catch (error) {
    console.error('Error fetching gallery templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// Simple thumbnail generator
function generateThumbnail(html: string): string {
  // Extract first image or return a placeholder
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
  if (imgMatch) {
    return imgMatch[1]
  }
  return 'https://placehold.co/300x200?text=Template+Preview'
}
