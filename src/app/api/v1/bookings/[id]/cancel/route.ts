import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { bookingCommandError } from "@/lib/marketplace/bookings/api";
import { bookingCancelSchema } from "@/lib/marketplace/bookings/schemas";
import { cancelBooking, getBooking, participantRole, previewBookingCancellation } from "@/lib/marketplace/bookings/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

async function cancellationContext(bookingId: string) {
  const context = await getAuthenticatedContext();
  if (!context) return { response: apiError(401, "UNAUTHENTICATED", "Sign in to manage this booking.") };
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) {
    return { response: apiError(404, "FEATURE_NOT_AVAILABLE", "Booking cancellation is not available yet.") };
  }
  const booking = await getBooking(context, bookingId);
  if (!booking.data) return { response: apiError(404, "BOOKING_NOT_FOUND", "The booking was not found.") };
  const role = participantRole(context, booking.data);
  if (!role) return { response: apiError(403, "FORBIDDEN", "You do not have access to this booking.") };
  return { context, role, response: null };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await cancellationContext(id);
  if (resolved.response) return resolved.response;
  const { data, error } = await previewBookingCancellation(resolved.context!, id, resolved.role!);
  if (error || !data) return bookingCommandError(error);
  return apiSuccess({ cancellation: data });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await cancellationContext(id);
  if (resolved.response) return resolved.response;
  const parsed = bookingCancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_CANCELLATION", "Check the cancellation reason.");
  const { data, error } = await cancelBooking(resolved.context!, id, resolved.role!, parsed.data);
  if (error || !data) return bookingCommandError(error);
  return apiSuccess({ booking: data });
}
