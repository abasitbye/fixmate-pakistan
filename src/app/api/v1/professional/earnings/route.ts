import { apiError, apiSuccess } from "@/lib/api/response";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { listEarnings } from "@/lib/marketplace/payments/service";

export async function GET() {
  const auth = await getPaymentContext("Sign in to view earnings.");
  if (!auth.context) return auth.response;
  if (!auth.context.roles.includes("professional"))
    return apiError(403, "FORBIDDEN", "Professional access is required.");
  const { data, error } = await listEarnings(auth.context);
  if (error)
    return apiError(
      500,
      "EARNINGS_LOAD_FAILED",
      "Earnings could not be loaded.",
    );
  return apiSuccess({ earnings: data });
}
