import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ isActive: z.boolean(), reason: z.string().trim().min(5).max(500) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getPaymentContext("Sign in to update fee rules.");
  if (!auth.context) return auth.response;
  if (!auth.context.roles.includes("super_admin")) return apiError(403, "FORBIDDEN", "Super administrator access is required.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_FEE_RULE_UPDATE", "Add the rule status and audit reason.");
  const id = (await params).id;
  const { data, error } = await createAdminClient().rpc("set_fee_rule_active", {
    p_actor_profile_id: auth.context.profile.id, p_actor_role: "super_admin",
    p_fee_rule_id: id, p_is_active: parsed.data.isActive, p_reason: parsed.data.reason,
  });
  if (error || !data) return apiError(404, "FEE_RULE_NOT_FOUND", "The fee rule was not found.");
  return apiSuccess({ feeRule: data });
}
