import puppeteer from 'puppeteer'
import { query } from '@/lib/db/connection'

export async function generateScreenshot(jobId: string, url: string): Promise<void> {
  try {
    if (!url) return

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 720 })
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 10000
    })

    // Wait for page to settle (Puppeteer v21+ doesn't have waitForTimeout)
    await new Promise(resolve => setTimeout(resolve, 1000))

    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'base64'
    }) as string

    await browser.close()

    await query('UPDATE jobs SET screenshot = $1 WHERE id = $2', [screenshot, jobId])
  } catch (error) {
    console.error(`Failed to generate screenshot for job ${jobId}:`, error)
    // Don't throw - screenshot generation failure shouldn't break job creation
  }
}

