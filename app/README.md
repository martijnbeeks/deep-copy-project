
# DeepCopy Frontend

## Development

### Standard dev server

```bash
cd app
npm run dev
```

### Dev server with webhook watcher

Starts Next.js and a background watcher that monitors processing jobs and triggers the webhook locally (simulates what the Lambda does in production):

```bash
cd app
npm run dev:webhook
```

The watcher automatically:
- Detects which port Next.js is running on
- Queries the database for jobs in `processing` status
- Polls the DeepCopy API for their completion
- Sends a signed webhook to `localhost` when a job completes
- Stores the results in the database via the webhook endpoint

This is **only needed for local development**. In production on Vercel, the Lambda sends the webhook directly.

### Watch a single job

```bash
./scripts/local-webhook-watcher.sh <JOB_ID> [port]
```

## Job Completion Architecture

When a job finishes on the Lambda:

1. **PostgresNotifier** writes `status=completed` directly to the Neon PostgreSQL database
2. **Webhook callback** sends a signed POST to `/api/webhooks/job-complete`, which fetches results from the DeepCopy API and stores them in the database
3. **React Query `refetchInterval`** on the frontend re-reads from the database every 5s while processing jobs exist

### Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `WEBHOOK_SECRET` | `.env` + AWS Secrets Manager | HMAC-SHA256 shared secret for webhook authentication |
| `NEXT_PUBLIC_APP_URL` | `.env` + Vercel | Base URL for constructing the callback URL |
| `DATABASE_URL` | `.env` + Lambda | Neon PostgreSQL connection string |

---

## Maintenance Mode

The application includes a maintenance mode feature that allows you to block public access while still being able to access the app yourself.

### How to Enable Maintenance 

1. Add the following environment variables to your `.env.local` file:
   ```env
   MAINTENANCE_MODE=true
   MAINTENANCE_BYPASS_TOKEN=your-secret-token-here
   ```

2. Restart your Next.js server for the changes to take effect.

### How to Access the App During Maintenance

When maintenance mode is enabled, you can bypass it by visiting:
```
https://yourdomain.com/?bypass=your-secret-token-here
```

This will:
- Set a bypass cookie that lasts for 7 days
- Redirect you to the home page
- Allow you to access the app normally

### How to Disable Maintenance Mode

Set `MAINTENANCE_MODE=false` in your `.env.local` file or remove the variable entirely, then restart your server.

### Notes

- The bypass cookie is valid for 7 days
- Static assets and API routes are still accessible during maintenance (you can modify this in `middleware.ts` if needed)
- Make sure to use a strong, unique token for `MAINTENANCE_BYPASS_TOKEN` in production
