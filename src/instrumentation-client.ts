import * as Sentry from "@sentry/nextjs";

import { redactSensitiveData } from "@/lib/sentry/sanitize";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.data;
      if (event.request.headers) {
        event.request.headers = redactSensitiveData(
          event.request.headers,
        ) as typeof event.request.headers;
      }
    }
    event.extra = redactSensitiveData(event.extra) as typeof event.extra;
    event.contexts = redactSensitiveData(
      event.contexts,
    ) as typeof event.contexts;
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

