import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { parseIdempotencyKey } from "@/lib/marketplace/idempotency";

import { executionCommandError } from "./api";
import { quotationDecisionSchema } from "./schemas";
import { decideQuotation } from "./service";

export function quotationDecisionHandler(
  decision: "approved" | "rejected" | "revision_requested" | "clarification_requested",
) {
  return async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const context = await getAuthenticatedContext();
    if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to decide this quotation.");
    if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Quotation decisions are not available yet.");
    const parsed = quotationDecisionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(400, "INVALID_QUOTATION_DECISION", "Check the quotation version and reason.");
    let key: string; try { key = parseIdempotencyKey(request); } catch { return apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid action key is required."); }
    const { data, error } = await decideQuotation(context, (await params).id, parsed.data.version, decision, parsed.data.reason, key);
    if (error || !data) return executionCommandError(error);
    return apiSuccess({ quotation: data });
  };
}
