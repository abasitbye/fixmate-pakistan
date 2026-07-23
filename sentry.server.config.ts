import * as Sentry from "@sentry/nextjs";

import { redactSensitiveData } from "./src/lib/sentry/sanitize";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.data;
      delete event.request.headers;
    }
    event.extra = redactSensitiveData(event.extra) as typeof event.extra;
    event.contexts = redactSensitiveData(
      event.contexts,
    ) as typeof event.contexts;
    return event;
  },
});

