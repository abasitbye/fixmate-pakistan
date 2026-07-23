import { apiError, apiSuccess } from "@/lib/api/response";
import { parseIdempotencyKey } from "@/lib/marketplace/idempotency";
import { paymentCommandError } from "@/lib/marketplace/payments/api";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { confirmManualPayment } from "@/lib/marketplace/payments/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getPaymentContext("Sign in to confirm a payment.");
  if (!auth.context) return auth.response;
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
  const { data, error } = await confirmManualPayment(
    auth.context,
    (await params).id,
    key,
  );
  if (error || !data) return paymentCommandError(error);
  return apiSuccess({ payment: data });
}
