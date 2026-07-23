import "server-only";

import * as Sentry from "@sentry/nextjs";
import { randomUUID } from "node:crypto";

import { redactSensitiveData } from "@/lib/sentry/sanitize";

type SafeContext = Record<string, unknown>;

export function operationalReference(request?: Request) {
  return (
    request?.headers.get("x-request-id") ??
    request?.headers.get("x-vercel-id") ??
    randomUUID()
  );
}

export function captureOperationalError(
  error: unknown,
  operation: string,
  context: SafeContext = {},
) {
  const safeContext = redactSensitiveData(context) as SafeContext;
  Sentry.captureException(error, {
    tags: { operation },
    extra: safeContext,
  });

  console.error(
    JSON.stringify({
      level: "error",
      operation,
      context: safeContext,
      message: error instanceof Error ? error.name : "OperationalError",
      timestamp: new Date().toISOString(),
    }),
  );
}
