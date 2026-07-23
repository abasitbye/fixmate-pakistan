import { apiError, apiSuccess } from "@/lib/api/response";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { listPayouts } from "@/lib/marketplace/payments/service";

export async function GET() {
  const auth = await getPaymentContext("Sign in to view payouts.");
  if (!auth.context) return auth.response;
  if (!auth.context.roles.includes("professional"))
    return apiError(403, "FORBIDDEN", "Professional access is required.");
  const { data, error } = await listPayouts(auth.context);
  if (error)
    return apiError(500, "PAYOUTS_LOAD_FAILED", "Payouts could not be loaded.");
  return apiSuccess({ payouts: data });
}
