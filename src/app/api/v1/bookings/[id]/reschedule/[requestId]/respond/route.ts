import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { bookingCommandError } from "@/lib/marketplace/bookings/api";
import { bookingRescheduleResponseSchema } from "@/lib/marketplace/bookings/schemas";
import { respondBookingReschedule } from "@/lib/marketplace/bookings/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to respond to this request.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Rescheduling is not available yet.");
  }
  const parsed = bookingRescheduleResponseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_RESCHEDULE_RESPONSE", "Choose accept or decline.");
  const { id, requestId } = await params;
  const { data, error } = await respondBookingReschedule(context, id, requestId, parsed.data.accept);
  if (error || !data) return bookingCommandError(error);
  return apiSuccess({ booking: data });
}
