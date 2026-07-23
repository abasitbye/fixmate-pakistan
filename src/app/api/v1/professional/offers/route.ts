import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { listProfessionalOffers } from "@/lib/marketplace/offers/service";

export async function GET() {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to view offers.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.matching_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Professional offers are not available yet.");
  }
  const { data, error } = await listProfessionalOffers(context);
  if (error) return apiError(500, "OFFERS_LOAD_FAILED", "Your offers could not be loaded.");
  return apiSuccess({ offers: data });
}
