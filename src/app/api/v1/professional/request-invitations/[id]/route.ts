import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { getProfessionalInvitation } from "@/lib/marketplace/matching/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to view this invitation.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.matching_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Professional matching is not available yet.");
  }
  const { data, error } = await getProfessionalInvitation(context, (await params).id);
  if (error || !data) return apiError(404, "INVITATION_NOT_FOUND", "The invitation was not found.");
  return apiSuccess({ invitation: data });
}
