import { apiError, apiSuccess } from "@/lib/api/response";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { feeRuleSchema } from "@/lib/marketplace/payments/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await getPaymentContext("Sign in to view fee rules.");
  if (!auth.context) return auth.response;
  if (!auth.context.roles.some((role) => ["admin", "super_admin"].includes(role))) return apiError(403, "FORBIDDEN", "Administrator access is required.");
  const { data, error } = await auth.context.supabase.from("fee_rules").select("*").order("effective_from", { ascending: false });
  if (error) return apiError(500, "FEE_RULES_LOAD_FAILED", "Fee rules could not be loaded.");
  return apiSuccess({ feeRules: data });
}

export async function POST(request: Request) {
  const auth = await getPaymentContext("Sign in to configure fee rules.");
  if (!auth.context) return auth.response;
  if (!auth.context.roles.includes("super_admin")) return apiError(403, "FORBIDDEN", "Super administrator access is required.");
  const parsed = feeRuleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_FEE_RULE", "Check the fee rule values and effective dates.");
  const value = parsed.data;
  const { data, error } = await createAdminClient().rpc("create_fee_rule", {
    p_actor_profile_id: auth.context.profile.id, p_actor_role: "super_admin",
    p_payload: {
      name: value.name, service_category_id: value.serviceCategoryId ?? "",
      city_id: value.cityId ?? "", fee_type: value.feeType,
      percentage_basis_points: value.percentageBasisPoints, fixed_amount_minor: value.fixedAmountMinor,
      minimum_fee_minor: value.minimumFeeMinor ?? "", maximum_fee_minor: value.maximumFeeMinor ?? "",
      effective_from: value.effectiveFrom, effective_until: value.effectiveUntil ?? "", is_active: value.isActive,
    },
  });
  if (error || !data) return apiError(500, "FEE_RULE_SAVE_FAILED", "The fee rule could not be saved.");
  return apiSuccess({ feeRule: data }, { status: 201 });
}
