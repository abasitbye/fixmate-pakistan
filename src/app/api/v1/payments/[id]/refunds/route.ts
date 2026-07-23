import { apiError, apiSuccess } from "@/lib/api/response";
import { parseIdempotencyKey } from "@/lib/marketplace/idempotency";
import { paymentCommandError } from "@/lib/marketplace/payments/api";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { refundRequestSchema } from "@/lib/marketplace/payments/schemas";
import { requestRefund } from "@/lib/marketplace/payments/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getPaymentContext("Sign in to request a refund.");
  if (!auth.context) return auth.response;
  const parsed = refundRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return apiError(
      400,
      "INVALID_REFUND_REQUEST",
      "Check the refund amount and reason.",
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
  const { data, error } = await requestRefund(
    auth.context,
    (await params).id,
    parsed.data.amountMinor,
    parsed.data.reason,
    key,
  );
  if (error || !data) return paymentCommandError(error);
  return apiSuccess({ refund: data }, { status: 201 });
}
