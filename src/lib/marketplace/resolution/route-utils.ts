import { apiError } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
export async function getResolutionContext() {
  const context = await getAuthenticatedContext();
  if (!context)
    return {
      context: null,
      response: apiError(
        401,
        "UNAUTHENTICATED",
        "Sign in to access this case.",
      ),
    };
  if (!(await isMarketplaceFeatureEnabled("phase2.resolution_enabled")))
    return {
      context: null,
      response: apiError(
        404,
        "FEATURE_NOT_AVAILABLE",
        "Reviews and resolution are not available yet.",
      ),
    };
  return { context, response: null };
}
