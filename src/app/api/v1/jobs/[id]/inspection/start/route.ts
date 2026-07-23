import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { executionCommandError } from "@/lib/marketplace/execution/api";
import { workVersionSchema } from "@/lib/marketplace/execution/schemas";
import { startInspection } from "@/lib/marketplace/execution/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to start inspection.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Inspection is not available yet.");
  const parsed = workVersionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_INSPECTION", "Refresh the job and try again.");
  const { data, error } = await startInspection(context, (await params).id, parsed.data.version);
  if (error || !data) return executionCommandError(error);
  return apiSuccess({ inspection: data }, { status: 201 });
}
