import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { listCustomerOffers } from "@/lib/marketplace/offers/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to compare offers.");
  if (!await isMarketplaceFeatureEnabled("phase2.matching_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Offer comparison is not available yet.");
  }
  const { data, error } = await listCustomerOffers(context, (await params).id);
  if (error) return apiError(500, "OFFERS_LOAD_FAILED", "Offers could not be loaded.");
  return apiSuccess({ offers: data });
}
