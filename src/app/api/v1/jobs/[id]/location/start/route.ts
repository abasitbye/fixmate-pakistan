import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { jobCommandError } from "@/lib/marketplace/jobs/api";
import { locationConsentSchema } from "@/lib/marketplace/jobs/schemas";
import { startLocationSession } from "@/lib/marketplace/jobs/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to share job location.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Location sharing is not available yet.");
  }
  const parsed = locationConsentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "LOCATION_CONSENT_REQUIRED", "Explicit location-sharing consent is required.");
  const { data, error } = await startLocationSession(
    context,
    (await params).id,
    request.headers.get("user-agent")?.slice(0, 500) ?? "",
  );
  if (error || !data) return jobCommandError(error);
  return apiSuccess({ session: data }, { status: 201 });
}
