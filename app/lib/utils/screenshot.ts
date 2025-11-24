import { chromium } from 'playwright'
import { query } from '@/lib/db/connection'

export async function generateScreenshot(jobId: string, url: string): Promise<void> {
  let browser = null
  try {
    if (!url) {
      console.error(`No URL provided for job ${jobId}`)
      return
    }

    console.log(`Starting screenshot generation for job ${jobId}, URL: ${url}`)

    browser = await chromium.launch({
      headless: true,
    })

    const page = await browser.newPage()
    await page.setViewportSize({ width: 1280, height: 720 })

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })

    // Wait for page to settle
    await new Promise(resolve => setTimeout(resolve, 2000))

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false
    })

    await browser.close()
    browser = null

    // Convert buffer to base64
    const base64Screenshot = screenshot.toString('base64')

    await query('UPDATE jobs SET screenshot = $1 WHERE id = $2', [base64Screenshot, jobId])

    console.log(`Screenshot generated successfully for job ${jobId}`)
  } catch (error) {
    console.error(`Failed to generate screenshot for job ${jobId}:`, error)

    // Ensure browser is closed even on error
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.error('Error closing browser:', closeError)
      }
    }

    // Re-throw so API route can handle it properly
    throw error
  }
}

