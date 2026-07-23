import { apiError, apiSuccess } from "@/lib/api/response";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { parseIdempotencyKey } from "@/lib/marketplace/idempotency";
import { runRequestMatching } from "@/lib/marketplace/matching/service";
import { requestCommandError } from "@/lib/marketplace/requests/api";
import { requestSubmitSchema } from "@/lib/marketplace/requests/schemas";
import { submitCustomerRequest } from "@/lib/marketplace/requests/service";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to submit this request.");
  if (!await isMarketplaceFeatureEnabled("phase2.requests_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Service requests are not available yet.");
  }
  const allowed = await consumeRateLimit({
    scope: "marketplace.request.submit",
    identifier: context.profile.id,
    limit: 10,
    windowSeconds: 3600,
  });
  if (!allowed) return apiError(429, "RATE_LIMITED", "Please wait before submitting again.");
  const parsed = requestSubmitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_SUBMISSION", "Complete the security check and review the request.");
  const turnstile = await verifyTurnstileToken(parsed.data.turnstileToken);
  if (!turnstile.success || turnstile.action !== "service_request_submit") {
    return apiError(400, "SECURITY_CHECK_FAILED", "Complete the security verification again.");
  }
  const { data: consentTypes, error: consentTypeError } = await context.supabase
    .from("consent_types")
    .select("id,current_version")
    .in("code", ["terms_of_service", "privacy_policy"]);
  if (consentTypeError || consentTypes?.length !== 2) {
    return apiError(
      500,
      "CONSENT_UNAVAILABLE",
      "The marketplace policies could not be recorded.",
    );
  }
  const { error: consentError } = await context.supabase
    .from("user_consents")
    .upsert(
      consentTypes.map((consent) => ({
        user_profile_id: context.profile.id,
        consent_type_id: consent.id,
        version: consent.current_version,
        accepted: true,
      })),
      { onConflict: "user_profile_id,consent_type_id,version" },
    );
  if (consentError) {
    return apiError(
      500,
      "CONSENT_SAVE_FAILED",
      "The marketplace policies could not be recorded.",
    );
  }
  let key: string;
  try {
    key = parseIdempotencyKey(request);
  } catch {
    return apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid action key is required.");
  }
  const { data, error } = await submitCustomerRequest(
    context,
    (await params).id,
    parsed.data.version,
    key,
  );
  if (error || !data) return requestCommandError(error);
  if (await isMarketplaceFeatureEnabled("phase2.matching_enabled")) {
    await runRequestMatching(data.id, context.profile.id).catch(() => null);
  }
  return apiSuccess({ request: data });
}
