import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { listProfessionalInvitations } from "@/lib/marketplace/matching/service";

export async function GET() {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to view invitations.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.matching_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Professional matching is not available yet.");
  }
  const { data, error } = await listProfessionalInvitations(context);
  if (error) return apiError(500, "INVITATIONS_LOAD_FAILED", "Invitations could not be loaded.");
  return apiSuccess({ invitations: data });
}
