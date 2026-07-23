import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { jobCommandError } from "@/lib/marketplace/jobs/api";
import { stopLocationSession } from "@/lib/marketplace/jobs/service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to stop location sharing.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Location sharing is not available yet.");
  }
  const { data, error } = await stopLocationSession(context, (await params).id);
  if (error || !data) return jobCommandError(error);
  return apiSuccess({ session: data });
}
