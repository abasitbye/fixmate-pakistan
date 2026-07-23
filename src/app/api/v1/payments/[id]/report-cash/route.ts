import { apiError, apiSuccess } from "@/lib/api/response";
import { paymentCommandError } from "@/lib/marketplace/payments/api";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { manualPaymentReportSchema } from "@/lib/marketplace/payments/schemas";
import { reportManualPayment } from "@/lib/marketplace/payments/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getPaymentContext("Sign in to report a payment.");
  if (!auth.context) return auth.response;
  const parsed = manualPaymentReportSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success)
    return apiError(400, "INVALID_PAYMENT_REPORT", "Check the payment note.");
  const { data, error } = await reportManualPayment(
    auth.context,
    (await params).id,
    parsed.data.note,
  );
  if (error || !data) return paymentCommandError(error);
  return apiSuccess({ payment: data });
}
