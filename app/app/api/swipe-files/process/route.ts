import { NextRequest, NextResponse } from 'next/server'
import { createInjectedTemplate, getInjectableTemplateById } from '@/lib/db/queries'
import { extractContentFromSwipeResult, injectContentIntoTemplate } from '@/lib/utils/template-injection'
import { query } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  try {
    const { jobId, angle, swipeFileResponse } = await request.json()

    if (!jobId || !angle || !swipeFileResponse) {
      return NextResponse.json(
        { error: 'jobId, angle, and swipeFileResponse are required' },
        { status: 400 }
      )
    }


    // Get the angle index for this angle by looking up the job's angles
    let angleIndex = 1 // Default to 1 if we can't find it
    try {
      const resultQuery = await query(
        `SELECT metadata FROM results WHERE job_id = $1`,
        [jobId]
      )
      
      if (resultQuery.rows.length > 0) {
        const metadata = resultQuery.rows[0].metadata
        const fullResult = metadata?.full_result || metadata
        const swipeResults = fullResult?.results?.swipe_results || fullResult?.swipe_results || []
        
        if (Array.isArray(swipeResults) && swipeResults.length > 0) {
          // Find the index of the matching angle
          const angleIndexFound = swipeResults.findIndex((swipe: any) => {
            const swipeAngle = swipe?.angle || swipe?.angle_name || ''
            return swipeAngle === angle || swipeAngle.includes(angle) || angle.includes(swipeAngle)
          })
          
          if (angleIndexFound >= 0) {
            angleIndex = angleIndexFound + 1 // 1-based index
          } else {
            // If not found, try to get from existing injected templates
            const existingTemplates = await query(
              `SELECT DISTINCT angle_index FROM injected_templates WHERE job_id = $1 AND angle_name = $2 LIMIT 1`,
              [jobId, angle]
            )
            if (existingTemplates.rows.length > 0) {
              angleIndex = existingTemplates.rows[0].angle_index
            } else {
              // Get the max angle_index and add 1
              const maxIndexQuery = await query(
                `SELECT MAX(angle_index) as max_index FROM injected_templates WHERE job_id = $1`,
                [jobId]
              )
              if (maxIndexQuery.rows[0]?.max_index) {
                angleIndex = (maxIndexQuery.rows[0].max_index as number) + 1
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not determine angle index, using default:`, error)
    }

    const processedTemplates = []
    const errors = []

    // Process each template in the swipe file response
    // Response structure: { "L00001": { full_advertorial: {...} }, "A00003": { full_advertorial: {...} } }
    // Handle case where response might be nested or have different structure
    let responseData = swipeFileResponse
    
    // Check if response is nested in a result or data property
    if (swipeFileResponse.result && typeof swipeFileResponse.result === 'object') {
      responseData = swipeFileResponse.result
    } else if (swipeFileResponse.data && typeof swipeFileResponse.data === 'object') {
      responseData = swipeFileResponse.data
    }
    
    // Ensure we have an object to iterate over
    if (!responseData || typeof responseData !== 'object' || Array.isArray(responseData)) {
      console.error(`❌ Invalid swipe file response structure. Expected object with template IDs as keys, got:`, typeof responseData, Array.isArray(responseData))
      return NextResponse.json(
        { 
          error: 'Invalid swipe file response structure. Expected object with template IDs as keys.',
          receivedType: typeof responseData,
          isArray: Array.isArray(responseData),
          keys: responseData ? Object.keys(responseData) : []
        },
        { status: 400 }
      )
    }

    const templateEntries = Object.entries(responseData)
    for (let index = 0; index < templateEntries.length; index++) {
      const [templateId, swipeData] = templateEntries[index]
      try {
        // Validate template ID format (L00001, A00003, etc.)
        if (!templateId.match(/^[LA]\d+$/)) {
          console.warn(`⚠️ Skipping invalid template ID: ${templateId}`)
          continue
        }

        // Get the injectable template by ID
        const injectableTemplates = await getInjectableTemplateById(templateId)
        if (!injectableTemplates || injectableTemplates.length === 0) {
          console.error(`❌ Injectable template not found for ID: ${templateId}`)
          errors.push({ templateId, error: 'Injectable template not found' })
          continue
        }

        const injectableTemplate = injectableTemplates[0]

        // Determine advertorial type from template ID (L = listicle, A = advertorial)
        const advertorialType = templateId.startsWith('L') ? 'listicle' : 'advertorial'

        // Extract content from swipe data
        // Handle both { full_advertorial: {...} } and direct content
        const swipeContent = (swipeData as any).full_advertorial || swipeData
        
        // Check if swipe content is empty or has minimal data
        if (!swipeContent || (typeof swipeContent === 'object' && Object.keys(swipeContent).length === 0)) {
          console.warn(`⚠️ Template ${templateId} has empty or minimal swipe content`)
          errors.push({ templateId, error: 'Empty or minimal swipe content' })
          continue
        }

        // Extract structured content
        const contentData = extractContentFromSwipeResult(swipeContent, advertorialType)

        // Inject content into template
        const injectedHtml = injectContentIntoTemplate(injectableTemplate, contentData)

        // Store in database with angle_index (all templates for the same angle should have the same angle_index)
        const storedTemplate = await createInjectedTemplate(
          jobId,
          angle,
          templateId,
          injectedHtml,
          angleIndex // Use the determined angle_index for all templates of this angle
        )

        processedTemplates.push({
          templateId,
          angle,
          html: injectedHtml,
          templateName: injectableTemplate.name,
          storedId: storedTemplate.id
        })

        console.log(`✅ Processed template ${templateId} for angle "${angle}"`)
      } catch (error) {
        console.error(`❌ Error processing template ${templateId}:`, error)
        errors.push({
          templateId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        // Continue processing other templates even if one fails
      }
    }

    
    return NextResponse.json({
      success: processedTemplates.length > 0,
      processed: processedTemplates.length,
      total: templateEntries.length,
      errors: errors.length,
      templates: processedTemplates,
      errorDetails: errors
    })
  } catch (error) {
    console.error('❌ Error processing swipe file response:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process swipe file response' },
      { status: 500 }
    )
  }
}

