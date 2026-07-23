import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext, hasAnyRole } from "@/lib/auth/session";
import { bookingCommandError } from "@/lib/marketplace/bookings/api";
import { bookingNoShowSchema } from "@/lib/marketplace/bookings/schemas";
import { recordBookingNoShow } from "@/lib/marketplace/bookings/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to record this outcome.");
  if (!hasAnyRole(context.roles, ["support", "admin", "super_admin"])) {
    return apiError(403, "FORBIDDEN", "Support access is required.");
  }
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "No-show review is not available yet.");
  }
  const parsed = bookingNoShowSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_NO_SHOW", "Provide the outcome, detailed reason, and any evidence reference.");
  const { data, error } = await recordBookingNoShow(
    context,
    (await params).id,
    parsed.data.party,
    parsed.data.reason,
    parsed.data.evidenceReference,
  );
  if (error || !data) return bookingCommandError(error);
  return apiSuccess({ booking: data });
}
