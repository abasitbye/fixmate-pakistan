import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { parseIdempotencyKey } from "@/lib/marketplace/idempotency";
import { offerCommandError } from "@/lib/marketplace/offers/api";
import { offerSubmitSchema } from "@/lib/marketplace/offers/schemas";
import { submitProfessionalOffer } from "@/lib/marketplace/offers/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to submit this offer.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.matching_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Professional offers are not available yet.");
  }
  const parsed = offerSubmitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_OFFER_SUBMISSION", "Check the offer version.");
  let key: string;
  try { key = parseIdempotencyKey(request); } catch {
    return apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid action key is required.");
  }
  const { data, error } = await submitProfessionalOffer(context, (await params).id, parsed.data.version, key);
  if (error || !data) return offerCommandError(error);
  return apiSuccess({ offer: data });
}
