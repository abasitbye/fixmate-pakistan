import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { jobCommandError } from "@/lib/marketplace/jobs/api";
import { jobEnRouteSchema } from "@/lib/marketplace/jobs/schemas";
import { markJobEnRoute } from "@/lib/marketplace/jobs/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to update this job.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Travel status is not available yet.");
  }
  const parsed = jobEnRouteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_JOB_VERSION", "Refresh the job and try again.");
  const { data, error } = await markJobEnRoute(context, (await params).id, parsed.data.version);
  if (error || !data) return jobCommandError(error);
  return apiSuccess({ job: data });
}
