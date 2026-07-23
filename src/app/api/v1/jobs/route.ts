import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { listJobs } from "@/lib/marketplace/jobs/service";

export async function GET() {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to view jobs.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Jobs are not available yet.");
  }
  const { data, error } = await listJobs(context);
  if (error) return apiError(500, "JOBS_LOAD_FAILED", "Jobs could not be loaded.");
  return apiSuccess({ jobs: data });
}
