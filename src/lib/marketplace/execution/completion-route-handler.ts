import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { parseIdempotencyKey } from "@/lib/marketplace/idempotency";

import { executionCommandError } from "./api";
import { completionDecisionSchema } from "./schemas";
import { decideCompletion } from "./service";

export function completionDecisionHandler(decision: "confirmed" | "issue_reported") {
  return async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const context = await getAuthenticatedContext();
    if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to decide completion.");
    if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Completion decisions are not available yet.");
    const parsed = completionDecisionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(400, "INVALID_COMPLETION_DECISION", "Check the completion notes.");
    let key: string; try { key = parseIdempotencyKey(request); } catch { return apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid action key is required."); }
    const { data, error } = await decideCompletion(context, (await params).id, decision, parsed.data.notes, key);
    if (error || !data) return executionCommandError(error);
    return apiSuccess({ completion: data });
  };
}
