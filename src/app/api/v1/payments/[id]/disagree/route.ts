import { apiError, apiSuccess } from "@/lib/api/response";
import { paymentCommandError } from "@/lib/marketplace/payments/api";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { paymentDisagreementSchema } from "@/lib/marketplace/payments/schemas";
import { disputeManualPayment } from "@/lib/marketplace/payments/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getPaymentContext("Sign in to report a disagreement.");
  if (!auth.context) return auth.response;
  const parsed = paymentDisagreementSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return apiError(
      400,
      "INVALID_PAYMENT_DISAGREEMENT",
      "Explain the payment disagreement.",
    );
  const { data, error } = await disputeManualPayment(
    auth.context,
    (await params).id,
    parsed.data.reason,
  );
  if (error || !data) return paymentCommandError(error);
  return apiSuccess({ reconciliation: data }, { status: 201 });
}
