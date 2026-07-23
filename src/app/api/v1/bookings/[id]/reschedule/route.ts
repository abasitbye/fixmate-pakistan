import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { bookingCommandError } from "@/lib/marketplace/bookings/api";
import { bookingRescheduleSchema } from "@/lib/marketplace/bookings/schemas";
import { getBooking, participantRole, requestBookingReschedule } from "@/lib/marketplace/bookings/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to request a new schedule.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Rescheduling is not available yet.");
  }
  const parsed = bookingRescheduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_RESCHEDULE", "Check the proposed time and reason.", parsed.error.flatten().fieldErrors);
  const { id } = await params;
  const current = await getBooking(context, id);
  if (!current.data) return apiError(404, "BOOKING_NOT_FOUND", "The booking was not found.");
  const role = participantRole(context, current.data);
  if (role !== "customer" && role !== "professional") return apiError(403, "FORBIDDEN", "Only booking participants can reschedule.");
  const { data, error } = await requestBookingReschedule(context, id, role, parsed.data);
  if (error || !data) return bookingCommandError(error);
  return apiSuccess({ reschedule: data }, { status: 201 });
}
