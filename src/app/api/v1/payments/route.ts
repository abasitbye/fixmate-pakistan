import { apiError, apiSuccess } from "@/lib/api/response";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { listPayments } from "@/lib/marketplace/payments/service";

export async function GET() {
  const auth = await getPaymentContext();
  if (!auth.context) return auth.response;
  const { data, error } = await listPayments(auth.context);
  if (error)
    return apiError(
      500,
      "PAYMENTS_LOAD_FAILED",
      "Payments could not be loaded.",
    );
  return apiSuccess({ payments: data });
}
