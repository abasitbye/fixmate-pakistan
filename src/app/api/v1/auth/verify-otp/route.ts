import * as Sentry from "@sentry/nextjs";
import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getClientIp } from "@/lib/api/request";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { verifyOtpSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const parsed = verifyOtpSchema.safeParse(await request.json().catch(() => null));
  const email = request.cookies.get("fm_otp_email")?.value;
  if (!parsed.success || !email) {
    return apiError(400, "INVALID_CHALLENGE", "This code request is no longer valid. Request a new code.");
  }

  try {
    const allowed = await consumeRateLimit({
      scope: "otp_verify",
      identifier: `${email}:${getClientIp(request) ?? "unknown"}`,
      limit: 8,
      windowSeconds: 15 * 60,
    });
    if (!allowed) return apiError(429, "TOO_MANY_ATTEMPTS", "Too many attempts. Request a new code later.");

    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: parsed.data.token,
      type: "email",
    });
    if (error || !data.user) {
      return apiError(400, "INVALID_OTP", "That code is invalid or has expired.");
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("account_status,display_name,onboarding_completed_at")
      .eq("auth_user_id", data.user.id)
      .single();

    if (!profile || profile.account_status !== "active") {
      await supabase.auth.signOut();
      return apiError(403, "ACCOUNT_RESTRICTED", "This account is currently restricted. Contact support for help.");
    }

    const response = apiSuccess({
      next: profile.onboarding_completed_at
        ? "/customer"
        : profile.display_name
          ? "/auth/account-purpose"
          : "/auth/complete-profile",
    });
    response.cookies.delete("fm_otp_email");
    return response;
  } catch (error) {
    Sentry.captureException(error, { tags: { operation: "verify_email_otp" } });
    return apiError(503, "AUTH_UNAVAILABLE", "Verification is temporarily unavailable. Please try again.");
  }
}
