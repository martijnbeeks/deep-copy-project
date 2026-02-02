import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { handleApiError, createSuccessResponse } from '@/lib/middleware/error-handler'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
    try {
        logger.log(`🔍 Health check for template system`)

        const health: {
            timestamp: string
            status: string
            components: any
            summary?: {
                totalComponents: number
                healthyComponents: number
                degradedComponents: number
                unhealthyComponents: number
            }
        } = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            components: {} as any
        }

        // Check 1: Injectable templates table exists and has data
        try {
            const templatesResult = await query(`
        SELECT 
          COUNT(*) as total_count,
          COUNT(DISTINCT advertorial_type) as type_count,
          array_agg(DISTINCT advertorial_type) as types
        FROM injectable_templates
      `)

            const templateStats = templatesResult.rows[0]
            health.components.injectableTemplates = {
                status: 'healthy',
                totalCount: parseInt(templateStats.total_count),
                typeCount: parseInt(templateStats.type_count),
                types: templateStats.types || [],
                message: `Found ${templateStats.total_count} injectable templates`
            }

            if (parseInt(templateStats.total_count) === 0) {
                health.components.injectableTemplates.status = 'unhealthy'
                health.components.injectableTemplates.message = 'No injectable templates found'
                health.status = 'degraded'
            }
        } catch (error) {
            health.components.injectableTemplates = {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : String(error),
                message: 'Failed to query injectable templates table'
            }
            health.status = 'unhealthy'
        }

        // Check 2: Injected templates table exists
        try {
            const injectedResult = await query(`
        SELECT 
          COUNT(*) as total_count,
          COUNT(DISTINCT job_id) as job_count
        FROM injected_templates
      `)

            const injectedStats = injectedResult.rows[0]
            health.components.injectedTemplates = {
                status: 'healthy',
                totalCount: parseInt(injectedStats.total_count),
                jobCount: parseInt(injectedStats.job_count),
                message: `Found ${injectedStats.total_count} injected templates across ${injectedStats.job_count} jobs`
            }
        } catch (error) {
            health.components.injectedTemplates = {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : String(error),
                message: 'Failed to query injected templates table'
            }
            health.status = 'unhealthy'
        }

        // Check 3: Test template injection with sample data
        try {
            const { extractContentFromSwipeResult, injectContentIntoTemplate } = await import('@/lib/utils/template-injection')

            // Get a sample injectable template
            const sampleTemplateResult = await query('SELECT * FROM injectable_templates LIMIT 1')

            if (sampleTemplateResult.rows.length > 0) {
                const sampleTemplate = sampleTemplateResult.rows[0]

                // Create sample swipe result
                const sampleSwipeResult = {
                    angle: 'Test Angle',
                    headline: 'Test Headline',
                    subheadline: 'Test Subheadline',
                    content: 'Test content for health check',
                    author: 'Test Author',
                    date: new Date().toISOString()
                }

                // Test extraction
                const contentData = extractContentFromSwipeResult(sampleSwipeResult, 'advertorial')

                // Test injection
                const injectedHtml = injectContentIntoTemplate(sampleTemplate, contentData)

                health.components.templateInjection = {
                    status: 'healthy',
                    extractionWorking: !!contentData && Object.keys(contentData).length > 0,
                    injectionWorking: !!injectedHtml && injectedHtml.length > 100,
                    htmlLength: injectedHtml?.length || 0,
                    message: 'Template injection utilities working correctly'
                }
            } else {
                health.components.templateInjection = {
                    status: 'unhealthy',
                    message: 'No injectable templates available for testing'
                }
                health.status = 'degraded'
            }
        } catch (error) {
            health.components.templateInjection = {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : String(error),
                message: 'Template injection utilities failed'
            }
            health.status = 'unhealthy'
        }

        // Check 4: Recent job completion and template generation
        try {
            const recentJobsResult = await query(`
        SELECT 
          j.id,
          j.title,
          j.status,
          j.created_at,
          COUNT(it.id) as template_count
        FROM jobs j
        LEFT JOIN injected_templates it ON j.id = it.job_id
        WHERE j.status = 'completed'
        AND j.created_at > NOW() - INTERVAL '24 hours'
        GROUP BY j.id, j.title, j.status, j.created_at
        ORDER BY j.created_at DESC
        LIMIT 5
      `)

            const recentJobs = recentJobsResult.rows.map(row => ({
                id: row.id,
                title: row.title,
                status: row.status,
                created_at: row.created_at,
                template_count: parseInt(row.template_count)
            }))

            const jobsWithoutTemplates = recentJobs.filter(job => job.template_count === 0)

            health.components.recentJobs = {
                status: jobsWithoutTemplates.length === 0 ? 'healthy' : 'degraded',
                totalJobs: recentJobs.length,
                jobsWithoutTemplates: jobsWithoutTemplates.length,
                jobs: recentJobs,
                message: jobsWithoutTemplates.length === 0
                    ? 'All recent completed jobs have templates'
                    : `${jobsWithoutTemplates.length} recent jobs missing templates`
            }

            if (jobsWithoutTemplates.length > 0) {
                health.status = 'degraded'
            }
        } catch (error) {
            health.components.recentJobs = {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : String(error),
                message: 'Failed to check recent jobs'
            }
        }

        // Overall health assessment
        const unhealthyComponents = Object.values(health.components).filter((comp: any) => comp.status === 'unhealthy')
        const degradedComponents = Object.values(health.components).filter((comp: any) => comp.status === 'degraded')

        if (unhealthyComponents.length > 0) {
            health.status = 'unhealthy'
        } else if (degradedComponents.length > 0) {
            health.status = 'degraded'
        }

        health.summary = {
            totalComponents: Object.keys(health.components).length,
            healthyComponents: Object.values(health.components).filter((comp: any) => comp.status === 'healthy').length,
            degradedComponents: degradedComponents.length,
            unhealthyComponents: unhealthyComponents.length
        }

        const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 500

        return NextResponse.json(health, { status: statusCode })

    } catch (error) {
        logger.error('❌ Health check error:', error)
        return NextResponse.json(
            {
                timestamp: new Date().toISOString(),
                status: 'unhealthy',
                error: error instanceof Error ? error.message : String(error),
                message: 'Health check failed completely'
            },
            { status: 500 }
        )
    }
}
