import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { parseIdempotencyKey } from "@/lib/marketplace/idempotency";
import { offerCommandError } from "@/lib/marketplace/offers/api";
import { offerAcceptSchema } from "@/lib/marketplace/offers/schemas";
import { acceptProfessionalOffer } from "@/lib/marketplace/offers/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; offerId: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to select an offer.");
  if (!await isMarketplaceFeatureEnabled("phase2.matching_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Offer selection is not available yet.");
  }
  const parsed = offerAcceptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_SELECTION", "Refresh the offers and try again.");
  let key: string;
  try { key = parseIdempotencyKey(request); } catch {
    return apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid action key is required.");
  }
  const { id, offerId } = await params;
  const { data, error } = await acceptProfessionalOffer(
    context,
    id,
    offerId,
    parsed.data.version,
    parsed.data.requestVersion,
    key,
  );
  if (error || !data) return offerCommandError(error);
  return apiSuccess({ booking: data });
}
