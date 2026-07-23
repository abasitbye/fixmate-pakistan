import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

import { executionCommandError } from "./api";
import { changeOrderDecisionSchema, workVersionSchema } from "./schemas";
import { decideChangeOrder, resumeWork, startWork } from "./service";

export function changeOrderDecisionHandler(decision: "approved" | "rejected") {
  return async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const context = await getAuthenticatedContext();
    if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to decide this change order.");
    if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Change-order decisions are not available yet.");
    const parsed = changeOrderDecisionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(400, "INVALID_CHANGE_ORDER_DECISION", "Check the decision reason.");
    const { data, error } = await decideChangeOrder(context, (await params).id, decision, parsed.data.reason);
    if (error || !data) return executionCommandError(error);
    return apiSuccess({ changeOrder: data });
  };
}

export function workTransitionHandler(action: "start" | "resume") {
  return async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const context = await getAuthenticatedContext();
    if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to update this job.");
    if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
    if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Work controls are not available yet.");
    const parsed = workVersionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(400, "INVALID_JOB_VERSION", "Refresh the job and try again.");
    const id = (await params).id;
    const { data, error } = action === "start"
      ? await startWork(context, id, parsed.data.version)
      : await resumeWork(context, id, parsed.data.version);
    if (error || !data) return executionCommandError(error);
    return apiSuccess({ job: data });
  };
}
