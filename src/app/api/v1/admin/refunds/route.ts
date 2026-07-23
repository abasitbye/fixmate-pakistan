import { apiError, apiSuccess } from "@/lib/api/response";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";

export async function GET() {
  const auth = await getPaymentContext("Sign in to view refunds.");
  if (!auth.context) return auth.response;
  if (
    !auth.context.roles.some((role) => ["admin", "super_admin"].includes(role))
  ) {
    return apiError(403, "FORBIDDEN", "Administrator access is required.");
  }
  const { data, error } = await auth.context.supabase
    .from("refunds")
    .select(
      "id,refund_reference,job_id,payment_intent_id,currency_code,amount_minor,reason,provider,provider_reference,status,requested_by,approved_by,processed_at,created_at,payment_intents(payment_reference,amount_minor,status)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error)
    return apiError(500, "REFUNDS_LOAD_FAILED", "Refunds could not be loaded.");
  return apiSuccess({ refunds: data });
}
