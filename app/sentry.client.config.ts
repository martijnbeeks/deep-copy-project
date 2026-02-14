import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://f51ef0bfc242618e5b298aa60661e753@o4510738689425408.ingest.de.sentry.io/4510738713346128",
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,
  integrations: [
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
