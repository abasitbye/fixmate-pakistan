import "server-only";

import { z } from "zod";

import { getServerEnvironment } from "@/env/server";

const turnstileResponseSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
) {
  const body = new URLSearchParams({
    secret: getServerEnvironment().TURNSTILE_SECRET_KEY,
    response: token,
  });
  if (remoteIp) body.set("remoteip", remoteIp);

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    },
  );

  if (!response.ok) {
    return { success: false, reason: "verification_unavailable" as const };
  }

  const result = turnstileResponseSchema.safeParse(await response.json());
  if (!result.success || !result.data.success) {
    return { success: false, reason: "verification_failed" as const };
  }

  const productionHostname = new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://fixmate-pakistan.vercel.app",
  ).hostname;
  if (
    process.env.NODE_ENV === "production" &&
    result.data.hostname !== productionHostname
  ) {
    return { success: false, reason: "hostname_mismatch" as const };
  }

  return { success: true, action: result.data.action };
}

