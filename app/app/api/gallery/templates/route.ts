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
    const limit = parseInt(searchParams.get('limit') || '6') // Proper pagination - 6 templates per page
    const offset = (page - 1) * limit

    console.log(`🔍 Fetching gallery templates for user: ${userEmail} (ID: ${user.id})`)

    // Get completed jobs with their results metadata - SAME LOGIC AS RESULTS PAGE
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

    console.log(`📊 Found ${jobsResult.rows.length} completed jobs with results`)

    // Get total count for pagination
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

    // Generate templates dynamically - EXACT SAME LOGIC AS RESULTS PAGE
    const templates = []
    console.log(`🔄 Generating templates dynamically for ${jobsResult.rows.length} jobs`)

    for (const job of jobsResult.rows) {
      try {
        console.log(`🔍 Processing job ${job.id}: ${job.title}`)

        // Check if job has result with swipe_results - SAME AS RESULTS PAGE
        if (job.metadata?.full_result?.results?.swipe_results) {
          const swipeResults = job.metadata.full_result.results.swipe_results
          console.log(`📊 Found ${swipeResults.length} swipe results for job ${job.id}`)

          // Get injectable template for this job - SAME LOGIC AS RESULTS PAGE
          const templateType = job.advertorial_type === 'listicle' ? 'listicle' : 'advertorial'
          let injectableTemplate = null

          try {
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
          } catch (error) {
            console.error('❌ Error fetching injectable templates:', error)
            continue // Skip this job
          }

          if (injectableTemplate) {
            // Process each swipe result to create templates - SAME LOGIC AS RESULTS PAGE
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
          } else {
            console.log(`⚠️ No injectable template found for job ${job.id}, skipping`)
          }
        } else {
          console.log(`⚠️ Job ${job.id} has no swipe_results, skipping`)
        }
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
      source: 'dynamic_generation'
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