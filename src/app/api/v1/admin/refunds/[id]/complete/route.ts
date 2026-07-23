import { apiError, apiSuccess } from "@/lib/api/response";
import { paymentCommandError } from "@/lib/marketplace/payments/api";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { refundCompletionSchema } from "@/lib/marketplace/payments/schemas";
import { completeRefund } from "@/lib/marketplace/payments/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getPaymentContext("Sign in to record a refund.");
  if (!auth.context) return auth.response;
  if (
    !auth.context.roles.some((role) => ["admin", "super_admin"].includes(role))
  )
    return apiError(403, "FORBIDDEN", "Administrator access is required.");
  const parsed = refundCompletionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return apiError(
      400,
      "INVALID_REFUND_SETTLEMENT",
      "Add a valid settlement reference.",
    );
  const { data, error } = await completeRefund(
    auth.context,
    (await params).id,
    parsed.data.providerReference,
  );
  if (error || !data) return paymentCommandError(error);
  return apiSuccess({ refund: data });
}
