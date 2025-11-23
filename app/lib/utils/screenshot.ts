import { chromium } from 'playwright'
import { query } from '@/lib/db/connection'

export async function generateScreenshot(jobId: string, url: string): Promise<void> {
  try {
    if (!url) return

    // For Vercel, use playwright with proper configuration
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    })

    const page = await browser.newPage()
    await page.setViewportSize({ width: 1280, height: 720 })

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    })

    // Wait for page to settle
    await new Promise(resolve => setTimeout(resolve, 1000))

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false
    })

    await browser.close()

    // Convert buffer to base64
    const base64Screenshot = screenshot.toString('base64')

    await query('UPDATE jobs SET screenshot = $1 WHERE id = $2', [base64Screenshot, jobId])
  } catch (error) {
    console.error(`Failed to generate screenshot for job ${jobId}:`, error)
    // Don't throw - screenshot generation failure shouldn't break job creation
  }
}

