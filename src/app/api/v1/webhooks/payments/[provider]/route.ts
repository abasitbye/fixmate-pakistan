import { createHash } from "node:crypto";

import { apiError, apiSuccess } from "@/lib/api/response";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { getPaymentProvider } from "@/lib/marketplace/payments/provider";
import { captureOperationalError } from "@/lib/observability/operations";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  if (!(await isMarketplaceFeatureEnabled("phase2.payments_enabled")))
    return apiError(
      404,
      "FEATURE_NOT_AVAILABLE",
      "Payment webhooks are not available.",
    );
  const providerCode = (await params).provider.toLowerCase();
  const source =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed = await consumeRateLimit({
    scope: `marketplace.webhook.${providerCode}`,
    identifier: source,
    limit: 500,
    windowSeconds: 60,
  });
  if (!allowed) {
    return apiError(429, "RATE_LIMITED", "Webhook request limit exceeded.");
  }
  const adapter = getPaymentProvider(providerCode);
  if (!adapter?.supportsOnlinePayment) {
    return apiError(
      503,
      "ONLINE_PROVIDER_NOT_CONFIGURED",
      "This online payment provider is not configured.",
    );
  }
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000)
    return apiError(
      413,
      "WEBHOOK_TOO_LARGE",
      "Webhook payload exceeds the safe limit.",
    );
  try {
    const verified = await adapter.verifyWebhook(
      rawBody,
      request.headers.get("x-payment-signature"),
    );
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    if (verified.payloadHash !== payloadHash)
      return apiError(401, "WEBHOOK_INVALID", "Webhook verification failed.");
    const { data, error } = await createAdminClient().rpc(
      "record_payment_webhook_event",
      {
        p_provider: providerCode,
        p_provider_event_id: verified.providerEventId,
        p_signature_verified: true,
        p_event_type: verified.eventType,
        p_payload_hash: payloadHash,
      },
    );
    if (error || !data)
      return apiError(
        409,
        "WEBHOOK_CONFLICT",
        "The webhook event conflicts with an existing event.",
      );
    return apiSuccess({ received: true });
  } catch (error) {
    captureOperationalError(error, "payment_webhook_verification", {
      provider: providerCode,
    });
    return apiError(
      401,
      "WEBHOOK_INVALID",
      "Webhook signature verification failed.",
    );
  }
}
