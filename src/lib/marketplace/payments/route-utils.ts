import { apiError } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

export async function getPaymentContext(
  message = "Sign in to access payments.",
) {
  const context = await getAuthenticatedContext();
  if (!context)
    return {
      response: apiError(401, "UNAUTHENTICATED", message),
      context: null,
    };
  if (!(await isMarketplaceFeatureEnabled("phase2.payments_enabled"))) {
    return {
      response: apiError(
        404,
        "FEATURE_NOT_AVAILABLE",
        "Payments are not available yet.",
      ),
      context: null,
    };
  }
  return { response: null, context };
}
