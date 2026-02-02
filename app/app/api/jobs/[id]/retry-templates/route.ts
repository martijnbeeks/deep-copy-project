import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const jobId = params.id

        console.log(`🔧 Manual retry of template generation for job: ${jobId}`)

        // Get job details
        const jobResult = await query(`
      SELECT id, title, status, template_id, advertorial_type, created_at
      FROM jobs 
      WHERE id = $1
    `, [jobId])

        if (jobResult.rows.length === 0) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        const job = jobResult.rows[0]
        console.log(`📊 Job found:`, job)

        if (job.status !== 'completed') {
            return NextResponse.json({
                error: 'Job is not completed',
                status: job.status,
                message: 'Only completed jobs can have templates regenerated'
            }, { status: 400 })
        }

        // Clear any existing injected templates
        console.log(`🧹 Clearing existing templates for job ${jobId}...`)
        const deleteResult = await query(`DELETE FROM injected_templates WHERE job_id = $1`, [jobId])
        console.log(`✅ Deleted ${deleteResult.rowCount} existing templates`)

        // Get result data from results table
        const resultData = await query(`
      SELECT metadata
      FROM results 
      WHERE job_id = $1
      LIMIT 1
    `, [jobId])

        if (resultData.rows.length === 0) {
            return NextResponse.json({
                error: 'No result data found',
                message: 'Job exists but no result data found in results table'
            }, { status: 404 })
        }

        const metadata = resultData.rows[0].metadata
        const result = typeof metadata === 'string' ? JSON.parse(metadata) : metadata

        console.log(`📊 Result data found, starting template generation...`)

        // Import and call the template generation function
        const statusRoute = await import('@/app/api/jobs/[id]/status/route')
        const generateAndStoreInjectedTemplates = (statusRoute as any).generateAndStoreInjectedTemplates
        const templateResult = await generateAndStoreInjectedTemplates(jobId, result)

        console.log(`📊 Template generation result:`, templateResult)

        // Verify templates were created
        const verifyResult = await query(`
      SELECT COUNT(*) as count, 
             array_agg(angle_name) as angles
      FROM injected_templates 
      WHERE job_id = $1
    `, [jobId])

        const finalCount = parseInt(verifyResult.rows[0].count)
        const finalAngles = verifyResult.rows[0].angles || []

        return NextResponse.json({
            jobId,
            job: {
                id: job.id,
                title: job.title,
                status: job.status,
                template_id: job.template_id,
                advertorial_type: job.advertorial_type
            },
            templateGeneration: templateResult,
            verification: {
                templatesCreated: finalCount,
                angles: finalAngles
            },
            message: templateResult.success
                ? `Successfully generated ${templateResult.generated} templates`
                : `Template generation failed: ${templateResult.error}`,
            timestamp: new Date().toISOString()
        })

    } catch (error) {
        console.error('❌ Retry templates error:', error)
        return NextResponse.json(
            {
                error: 'Retry failed',
                details: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                jobId: params.id
            },
            { status: 500 }
        )
    }
}
