import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { listBookings } from "@/lib/marketplace/bookings/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

export async function GET() {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to view bookings.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Bookings are not available yet.");
  }
  const { data, error } = await listBookings(context);
  if (error) return apiError(500, "BOOKINGS_LOAD_FAILED", "Bookings could not be loaded.");
  return apiSuccess({ bookings: data });
}
