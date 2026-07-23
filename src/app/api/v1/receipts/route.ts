import { apiError, apiSuccess } from "@/lib/api/response";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { listReceipts } from "@/lib/marketplace/payments/service";

export async function GET() {
  const auth = await getPaymentContext("Sign in to view receipts.");
  if (!auth.context) return auth.response;
  const { data, error } = await listReceipts(auth.context);
  if (error)
    return apiError(
      500,
      "RECEIPTS_LOAD_FAILED",
      "Receipts could not be loaded.",
    );
  return apiSuccess({ receipts: data });
}
