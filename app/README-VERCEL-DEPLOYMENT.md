# Vercel Deployment with Playwright

## Important Notes

**Playwright CANNOT run on Vercel Edge Functions** - it only works on **Vercel Serverless Functions**.

## Current Setup

The screenshot functionality uses Playwright in Serverless Functions (configured in `vercel.json`).

## Deployment Steps

1. **Install Playwright browsers** (if not already done):
   ```bash
   npx playwright install chromium
   ```

2. **Vercel will automatically:**
   - Detect Playwright and bundle Chromium
   - Configure Serverless Functions with proper timeout (30s)
   - Handle browser binaries

3. **Environment Variables:**
   - Ensure `DATABASE_URL` is set in Vercel dashboard
   - No additional Playwright config needed

## Alternative: Edge-Compatible Solution

If you need Edge Functions, use a screenshot API service instead:

```typescript
// Use a service like screenshotapi.net or urlbox.io
const screenshotUrl = `https://api.screenshotapi.net/screenshot?url=${encodeURIComponent(url)}`
```

## Current Configuration

- **Function Type**: Serverless (not Edge)
- **Max Duration**: 30 seconds
- **Browser**: Chromium (via Playwright)
- **Location**: `app/api/screenshot/route.ts` and `app/api/jobs/route.ts`

