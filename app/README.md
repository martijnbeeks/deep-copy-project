##TRIGGER VERCEL

## Maintenance Mode

The application includes a maintenance mode feature that allows you to block public access while still being able to access the app yourself.

### How to Enable Maintenance Mode

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