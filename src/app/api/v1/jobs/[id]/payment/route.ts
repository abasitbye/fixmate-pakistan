import { apiError, apiSuccess } from "@/lib/api/response";
import { getJobPayment } from "@/lib/marketplace/payments/service";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getPaymentContext();
  if (!auth.context) return auth.response;
  const { data, error } = await getJobPayment(auth.context, (await params).id);
  if (error)
    return apiError(
      500,
      "PAYMENT_LOAD_FAILED",
      "Payment details could not be loaded.",
    );
  return apiSuccess({ payment: data });
}
