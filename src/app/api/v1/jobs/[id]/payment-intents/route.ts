import { apiError, apiSuccess } from "@/lib/api/response";
import { parseIdempotencyKey } from "@/lib/marketplace/idempotency";
import { paymentCommandError } from "@/lib/marketplace/payments/api";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { createPaymentIntentSchema } from "@/lib/marketplace/payments/schemas";
import { createPaymentIntent } from "@/lib/marketplace/payments/service";
import { enforceMarketplaceRateLimit } from "@/lib/marketplace/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getPaymentContext("Sign in to create a payment.");
  if (!auth.context) return auth.response;
  const limited = await enforceMarketplaceRateLimit({
    profileId: auth.context.profile.id,
    scope: "marketplace.payment.create",
    limit: 10,
    windowSeconds: 3600,
  });
  if (limited) return limited;
  const parsed = createPaymentIntentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return apiError(
      400,
      "INVALID_PAYMENT_METHOD",
      "Choose cash or manual bank transfer.",
    );
  let key: string;
  try {
    key = parseIdempotencyKey(request);
  } catch {
    return apiError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "A valid action key is required.",
    );
  }
  const { data, error } = await createPaymentIntent(
    auth.context,
    (await params).id,
    parsed.data.methodType,
    parsed.data.paymentMethodId ?? null,
    key,
  );
  if (error || !data) return paymentCommandError(error);
  return apiSuccess({ payment: data }, { status: 201 });
}
