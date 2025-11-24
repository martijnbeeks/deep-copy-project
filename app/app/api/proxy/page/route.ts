import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  return handleProxy(req)
}

export async function POST(req: NextRequest) {
  return handleProxy(req, "POST")
}

async function handleProxy(req: NextRequest, method: "GET" | "POST" = "GET") {
  try {
    const targetUrl = req.nextUrl.searchParams.get("url")

    if (!targetUrl) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
    }

    // Validate URL format
    try {
      const parsedUrl = new URL(targetUrl)
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return NextResponse.json({ error: "Only HTTP and HTTPS URLs are allowed" }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }

    // Forward incoming cookies if needed (optional)
    const incomingCookies = req.headers.get("cookie") || ""

    // Browser-like headers to defeat bot protection
    const browserHeaders: Record<string, string> = {
      "User-Agent":
        req.headers.get("user-agent") ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "identity", // prevent gzip blocking
      "Referer": "https://www.google.com/",
      "Cookie": incomingCookies, // forward cookies
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    }

    let body
    if (method === "POST") {
      body = await req.text()
    }

    // Faster timeout - 15 seconds total, 5 seconds for connection
    const controller = new AbortController()
    const totalTimeout = setTimeout(() => controller.abort(), 15000) // 15 seconds total
    const connectionTimeout = setTimeout(() => {
      controller.abort()
    }, 5000) // 5 seconds for initial connection

    const response = await fetch(targetUrl, {
      method,
      body,
      headers: browserHeaders,
      redirect: "follow",
      signal: controller.signal,
    })

    clearTimeout(connectionTimeout)
    clearTimeout(totalTimeout)

    // If target rejects: return error
    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Fetch failed: ${response.status} ${response.statusText}`,
          target: targetUrl,
        },
        { status: response.status }
      )
    }

    const contentType = response.headers.get("content-type") || ""

    // ✔ Handle HTML normally - stream for faster initial render
    if (contentType.includes("text/html")) {
      // Get full HTML to inject CSS
      let html = await response.text()

      // Inject CSS to disable pointer events on interactive elements
      const disableInteractionsCSS = `
        <style>
          a, button, input, select, textarea, [onclick], [role="button"], 
          [tabindex]:not([tabindex="-1"]), label[for] {
            pointer-events: none !important;
            cursor: default !important;
          }
          /* Allow scrolling */
          body, html {
            overflow: auto !important;
            pointer-events: auto !important;
          }
        </style>
      `

      // Inject CSS before </head> or at the start of <head>
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${disableInteractionsCSS}</head>`)
      } else if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${disableInteractionsCSS}`)
      } else {
        // No head tag, add it at the beginning
        html = `<head>${disableInteractionsCSS}</head>${html}`
      }

      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          "X-Frame-Options": "",
          "Content-Security-Policy": "",
        },
      })
    }

    // ✔ Handle binary files (images, pdfs, fonts, js, css)
    const buffer = Buffer.from(await response.arrayBuffer())
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "X-Frame-Options": "",
        "Content-Security-Policy": "",
      },
    })
  } catch (error: any) {
    // Handle timeout
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Request timeout - the page took too long to load" },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: "Proxy error: " + (error?.message || "Unknown error") },
      { status: 500 }
    )
  }
}

