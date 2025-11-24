import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetUrl = searchParams.get('url')

    if (!targetUrl) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }

    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(targetUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP and HTTPS URLs are allowed' }, { status: 400 })
    }

    // Fetch the page content with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 seconds

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': parsedUrl.origin,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    // Get the HTML content
    let html = await response.text()
    const baseUrl = parsedUrl.origin

    // Rewrite relative URLs to absolute URLs
    // Fix relative links
    html = html.replace(/href="\//g, `href="${baseUrl}/`)
    html = html.replace(/href='\//g, `href='${baseUrl}/`)
    html = html.replace(/href="(?!https?:\/\/|mailto:|tel:|#)([^"]+)"/g, (match, path) => {
      if (path.startsWith('//')) return match // Already protocol-relative
      if (path.startsWith('http')) return match // Already absolute
      return `href="${new URL(path, baseUrl).href}"`
    })

    // Fix relative src attributes
    html = html.replace(/src="\//g, `src="${baseUrl}/`)
    html = html.replace(/src='\//g, `src='${baseUrl}/`)
    html = html.replace(/src="(?!https?:\/\/|data:)([^"]+)"/g, (match, path) => {
      if (path.startsWith('//')) return match
      if (path.startsWith('http')) return match
      return `src="${new URL(path, baseUrl).href}"`
    })

    // Fix relative URLs in CSS (url())
    html = html.replace(/url\(['"]?\/([^'")]+)['"]?\)/g, `url('${baseUrl}/$1')`)

    // Remove X-Frame-Options and Content-Security-Policy headers from meta tags
    html = html.replace(/<meta[^>]*http-equiv=["']X-Frame-Options["'][^>]*>/gi, '')
    html = html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '')
    
    // Remove X-Frame-Options from any script tags that might set it
    html = html.replace(/X-Frame-Options[^;]*;?/gi, '')

    // Add base tag if not present to help with relative URLs
    if (!html.includes('<base')) {
      html = html.replace(/<head[^>]*>/i, `$&<base href="${baseUrl}/">`)
    }

    // Return the proxied HTML
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL', // Allow iframe embedding
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout - the page took too long to load' },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: `Failed to proxy page: ${errorMessage}` },
      { status: 500 }
    )
  }
}

