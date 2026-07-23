import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { getBooking } from "@/lib/marketplace/bookings/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to view this booking.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Bookings are not available yet.");
  }
  const result = await getBooking(context, (await params).id);
  if (result.error || !result.data) return apiError(404, "BOOKING_NOT_FOUND", "The booking was not found.");
  return apiSuccess({
    booking: result.data,
    exactAddress: result.exactAddress,
    customerContact: result.customerContact,
  });
}
