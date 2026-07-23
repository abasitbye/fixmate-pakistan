import { apiError, apiSuccess } from "@/lib/api/response";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";

export async function GET() {
  const auth = await getPaymentContext("Sign in to view reconciliation.");
  if (!auth.context) return auth.response;
  if (
    !auth.context.roles.some((role) =>
      ["support", "admin", "super_admin"].includes(role),
    )
  ) {
    return apiError(403, "FORBIDDEN", "Staff access is required.");
  }
  const { data, error } = await auth.context.supabase
    .from("payment_reconciliation_cases")
    .select(
      "id,payment_intent_id,opened_by,assigned_to,reason,status,resolution,evidence_reference,resolved_by,opened_at,resolved_at,payment_intents(payment_reference,amount_minor,currency_code,method_type,status)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error)
    return apiError(
      500,
      "RECONCILIATION_LOAD_FAILED",
      "Reconciliation cases could not be loaded.",
    );
  return apiSuccess({ cases: data });
}
