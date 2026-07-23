import { apiError, apiSuccess } from "@/lib/api/response";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { listPayments } from "@/lib/marketplace/payments/service";

export async function GET() {
  const auth = await getPaymentContext("Sign in to view payment operations.");
  if (!auth.context) return auth.response;
  if (
    !auth.context.roles.some((role) =>
      ["support", "admin", "super_admin"].includes(role),
    )
  )
    return apiError(403, "FORBIDDEN", "Staff access is required.");
  const { data, error } = await listPayments(auth.context);
  if (error)
    return apiError(
      500,
      "PAYMENTS_LOAD_FAILED",
      "Payments could not be loaded.",
    );
  return apiSuccess({ payments: data });
}
