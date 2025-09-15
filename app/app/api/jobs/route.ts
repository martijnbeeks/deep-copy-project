import { NextRequest, NextResponse } from 'next/server'
import { getJobsByUserId, createJob } from '@/lib/db/queries'

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
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined

    const jobs = await getJobsByUserId(user.id, { status, search })

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Jobs fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, brand_info, sales_page_url, template_id } = await request.json()

    if (!title || !brand_info) {
      return NextResponse.json(
        { error: 'Title and brand info are required' },
        { status: 400 }
      )
    }

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
    const job = await createJob({
      user_id: user.id,
      title,
      brand_info,
      sales_page_url,
      template_id
    })

    try {
      const { updateJobStatus, createResult } = await import('@/lib/db/queries')
      
      await updateJobStatus(job.id, 'processing', 25, `exec_${job.id}`)
      await new Promise(resolve => setTimeout(resolve, 2000))
      await updateJobStatus(job.id, 'processing', 75)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      let resultHtml = ''
      if (template_id) {
        const { getTemplateById } = await import('@/lib/db/queries')
        const template = await getTemplateById(template_id)
        if (template) {
          resultHtml = template.html_content
        }
      }
      
      if (!resultHtml) {
        resultHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Generated Content</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .content { line-height: 1.6; }
        .cta { background: #007bff; color: white; padding: 15px 30px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <p>Brand: ${brand_info}</p>
        ${sales_page_url ? `<p>Reference: <a href="${sales_page_url}">${sales_page_url}</a></p>` : ''}
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

      await createResult(job.id, resultHtml, {
        generated_at: new Date().toISOString(),
        word_count: resultHtml.split(' ').length,
        template_used: template_id
      })
      
      await updateJobStatus(job.id, 'completed', 100)
      
    } catch (error) {
      console.error('Job processing error:', error)
      const { updateJobStatus } = await import('@/lib/db/queries')
      await updateJobStatus(job.id, 'failed')
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error('Job creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    )
  }
}
