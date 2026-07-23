import * as Sentry from "@sentry/nextjs";
import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getClientIp } from "@/lib/api/request";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { requestOtpSchema } from "@/lib/auth/schemas";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { createAdminClient } from "@/lib/supabase/admin";

const GENERIC_MESSAGE = "If the address can receive mail, a verification code is on its way.";

export async function POST(request: NextRequest) {
  const parsed = requestOtpSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "INVALID_REQUEST", "Enter a valid email and complete the security check.");
  }

  const ip = getClientIp(request) ?? "unknown";
  const turnstile = await verifyTurnstileToken(parsed.data.turnstileToken, getClientIp(request));
  if (!turnstile.success) {
    return apiError(400, "SECURITY_CHECK_FAILED", "The security check expired or could not be verified. Please try again.");
  }

  try {
    const [emailAllowed, ipAllowed] = await Promise.all([
      consumeRateLimit({ scope: "otp_request_email", identifier: parsed.data.email, limit: 5, windowSeconds: 3600 }),
      consumeRateLimit({ scope: "otp_request_ip", identifier: ip, limit: 20, windowSeconds: 3600 }),
    ]);
    if (!emailAllowed || !ipAllowed) {
      return apiError(429, "TOO_MANY_REQUESTS", "Too many code requests. Please wait before trying again.");
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.signInWithOtp({
      email: parsed.data.email,
      options: { shouldCreateUser: true },
    });

    if (error) {
      Sentry.captureException(error, { tags: { operation: "request_email_otp" } });
      return apiError(503, "OTP_UNAVAILABLE", "We could not send a code right now. Please try again shortly.");
    }

    const response = apiSuccess({ message: GENERIC_MESSAGE, cooldownSeconds: 60 });
    response.cookies.set("fm_otp_email", parsed.data.email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    Sentry.captureException(error, { tags: { operation: "otp_rate_limit" } });
    return apiError(503, "AUTH_UNAVAILABLE", "Sign-in is temporarily unavailable. Please try again shortly.");
  }
}
