import { apiError, apiSuccess } from "@/lib/api/response";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { jobCommandError } from "@/lib/marketplace/jobs/api";
import { locationPointSchema } from "@/lib/marketplace/jobs/schemas";
import { recordLocationPoint } from "@/lib/marketplace/jobs/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to update job location.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Location sharing is not available yet.");
  }
  const parsed = locationPointSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_LOCATION", "The location point is invalid.");
  const { id } = await params;
  const allowed = await consumeRateLimit({
    scope: "job_location_point",
    identifier: `${context.profile.id}:${id}`,
    limit: 120,
    windowSeconds: 60,
  });
  if (!allowed) return apiError(429, "RATE_LIMITED", "Location updates are arriving too quickly.");
  const { data, error } = await recordLocationPoint(
    context,
    id,
    parsed.data.latitude,
    parsed.data.longitude,
    parsed.data.accuracyMeters,
  );
  if (error) return jobCommandError(error);
  if (!data) return apiError(410, "LOCATION_SESSION_EXPIRED", "The location-sharing session expired.");
  return apiSuccess({ point: data });
}
