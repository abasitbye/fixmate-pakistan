import * as Sentry from "@sentry/nextjs";
import type { NextRequest } from "next/server";

import { getServerEnvironment } from "@/env/server";
import { getClientIp } from "@/lib/api/request";
import { apiError, apiSuccess } from "@/lib/api/response";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { contactSchema } from "@/lib/contact/schema";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const parsed = contactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_CONTACT_MESSAGE", "Check the contact form and try again.", parsed.error.flatten().fieldErrors);
  const ip = getClientIp(request) ?? "unknown";
  const verification = await verifyTurnstileToken(parsed.data.turnstileToken, getClientIp(request));
  if (!verification.success) return apiError(400, "SECURITY_CHECK_FAILED", "Complete the security check again.");

  try {
    const allowed = await consumeRateLimit({ scope: "contact_message", identifier: `${ip}:${parsed.data.email}`, limit: 5, windowSeconds: 3600 });
    if (!allowed) return apiError(429, "TOO_MANY_REQUESTS", "Too many messages. Please wait before trying again.");

    const admin = createAdminClient();
    const { error } = await admin.from("contact_messages").insert({ name: parsed.data.name, email: parsed.data.email, subject: parsed.data.subject, message: parsed.data.message });
    if (error) throw error;

    const environment = getServerEnvironment();
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${environment.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: `FixMate Pakistan <${environment.EMAIL_FROM_ADDRESS}>`,
        to: [environment.EMAIL_FROM_ADDRESS],
        reply_to: parsed.data.email,
        subject: `[FixMate contact] ${parsed.data.subject}`,
        text: `From: ${parsed.data.name}\nReply email: ${parsed.data.email}\n\n${parsed.data.message}`,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!emailResponse.ok) Sentry.captureMessage("Contact notification email was not accepted", { level: "warning" });
    return apiSuccess({ received: true }, { status: 202 });
  } catch (error) {
    Sentry.captureException(error, { tags: { operation: "contact_message" } });
    return apiError(503, "CONTACT_UNAVAILABLE", "Your message could not be sent right now. Please try again later.");
  }
}
