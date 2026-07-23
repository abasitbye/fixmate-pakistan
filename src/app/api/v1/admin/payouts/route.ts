import { apiError, apiSuccess } from "@/lib/api/response";
import { parseIdempotencyKey } from "@/lib/marketplace/idempotency";
import { paymentCommandError } from "@/lib/marketplace/payments/api";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { payoutCreateSchema } from "@/lib/marketplace/payments/schemas";
import { createPayout, listPayouts } from "@/lib/marketplace/payments/service";

export async function GET() {
  const auth = await getPaymentContext("Sign in to view payouts.");
  if (!auth.context) return auth.response;
  if (
    !auth.context.roles.some((role) => ["admin", "super_admin"].includes(role))
  )
    return apiError(403, "FORBIDDEN", "Administrator access is required.");
  const { data, error } = await listPayouts(auth.context);
  if (error)
    return apiError(500, "PAYOUTS_LOAD_FAILED", "Payouts could not be loaded.");
  return apiSuccess({ payouts: data });
}

export async function POST(request: Request) {
  const auth = await getPaymentContext("Sign in to create a payout.");
  if (!auth.context) return auth.response;
  if (
    !auth.context.roles.some((role) => ["admin", "super_admin"].includes(role))
  )
    return apiError(403, "FORBIDDEN", "Administrator access is required.");
  const parsed = payoutCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return apiError(
      400,
      "INVALID_PAYOUT",
      "Select a professional and available earnings.",
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
  const { data, error } = await createPayout(
    auth.context,
    parsed.data.professionalId,
    parsed.data.earningIds,
    key,
  );
  if (error || !data) return paymentCommandError(error);
  return apiSuccess({ payout: data }, { status: 201 });
}
