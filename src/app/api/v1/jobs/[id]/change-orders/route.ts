import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { executionCommandError } from "@/lib/marketplace/execution/api";
import { changeOrderDraftSchema } from "@/lib/marketplace/execution/schemas";
import { listJobChangeOrders, saveChangeOrder } from "@/lib/marketplace/execution/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to view change orders.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Change orders are not available yet.");
  const { data, error } = await listJobChangeOrders(context, (await params).id);
  if (error) return apiError(404, "JOB_NOT_FOUND", "The job was not found.");
  return apiSuccess({ changeOrders: data });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to prepare a change order.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Change orders are not available yet.");
  const parsed = changeOrderDraftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_CHANGE_ORDER", "Check the scope, amounts, and schedule effect.", parsed.error.flatten().fieldErrors);
  const { data, error } = await saveChangeOrder(context, (await params).id, parsed.data);
  if (error || !data) return executionCommandError(error);
  return apiSuccess({ changeOrder: data }, { status: 201 });
}
