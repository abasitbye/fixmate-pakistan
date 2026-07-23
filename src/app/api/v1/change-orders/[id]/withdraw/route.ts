import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { executionCommandError } from "@/lib/marketplace/execution/api";
import { changeOrderSubmitSchema } from "@/lib/marketplace/execution/schemas";
import { withdrawChangeOrder } from "@/lib/marketplace/execution/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to withdraw this change order.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Change orders are not available yet.");
  const parsed = changeOrderSubmitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_CHANGE_ORDER", "Refresh and try again.");
  const { data, error } = await withdrawChangeOrder(context, (await params).id, parsed.data.version);
  if (error || !data) return executionCommandError(error);
  return apiSuccess({ changeOrder: data });
}
