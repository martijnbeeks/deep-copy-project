import { NextRequest, NextResponse } from 'next/server'
import { getJobById, updateJobStatus, createResult, getTemplateById } from '@/lib/db/queries'

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json()

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Get the job (without user restriction for processing)
    const { query } = await import('@/lib/db/connection')
    const result = await query('SELECT * FROM jobs WHERE id = $1', [jobId])
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    
    const job = result.rows[0]

    console.log('Processing job:', job.id)
    
    // Process the job
    await updateJobStatus(job.id, 'processing', 25, `exec_${job.id}`)
    console.log('Updated to 25%')
    
    await new Promise(resolve => setTimeout(resolve, 500))
    await updateJobStatus(job.id, 'processing', 75)
    console.log('Updated to 75%')
    
    await new Promise(resolve => setTimeout(resolve, 500))
    
    let resultHtml = ''
    if (job.template_id) {
      console.log('Getting template:', job.template_id)
      const template = await getTemplateById(job.template_id)
      if (template) {
        resultHtml = template.html_content
        console.log('Using template content')
      }
    }
    
    if (!resultHtml) {
      console.log('Using fallback content')
      resultHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${job.title} - Generated Content</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .content { line-height: 1.6; }
        .cta { background: #007bff; color: white; padding: 15px 30px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${job.title}</h1>
        <p>Brand: ${job.brand_info}</p>
        ${job.sales_page_url ? `<p>Reference: <a href="${job.sales_page_url}">${job.sales_page_url}</a></p>` : ''}
    </div>
    <div class="content">
        <h2>Why Choose Our Product?</h2>
        <p>Discover the amazing benefits of our innovative solution that's designed to transform your business. Our cutting-edge technology combined with years of expertise ensures you get the best results.</p>
        
        <h2>Key Features</h2>
        <ul>
            <li>Advanced technology integration</li>
            <li>24/7 customer support</li>
            <li>Proven track record of success</li>
            <li>Easy to implement and use</li>
        </ul>
        
        <h2>What Our Customers Say</h2>
        <p>"This solution has completely transformed our workflow. The results speak for themselves!" - Happy Customer</p>
        
        <h2>Get Started Today</h2>
        <p>Don't wait any longer. Join thousands of satisfied customers who have already made the switch.</p>
        <button class="cta">Start Your Free Trial</button>
    </div>
</body>
</html>`
    }

    console.log('Creating result for job:', job.id)
    await createResult(job.id, resultHtml, {
      generated_at: new Date().toISOString(),
      word_count: resultHtml.split(' ').length,
      template_used: job.template_id
    })
    
    console.log('Marking job as completed')
    await updateJobStatus(job.id, 'completed', 100)
    console.log('Job processing completed successfully')

    return NextResponse.json({ success: true, message: 'Job processed successfully' })
    
  } catch (error) {
    console.error('Job processing error:', error)
    
    // Try to mark job as failed if we have the jobId
    try {
      const { jobId } = await request.json()
      if (jobId) {
        await updateJobStatus(jobId, 'failed')
      }
    } catch (e) {
      // Ignore error if we can't mark as failed
    }
    
    return NextResponse.json(
      { error: 'Failed to process job' },
      { status: 500 }
    )
  }
}
