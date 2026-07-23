import { apiError, apiSuccess } from "@/lib/api/response";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { offerCommandError } from "@/lib/marketplace/offers/api";
import { offerDraftSchema } from "@/lib/marketplace/offers/schemas";
import { saveProfessionalOffer } from "@/lib/marketplace/offers/service";

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to create an offer.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.matching_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Professional offers are not available yet.");
  }
  const allowed = await consumeRateLimit({
    scope: "marketplace.offer.save",
    identifier: context.profile.id,
    limit: 30,
    windowSeconds: 3600,
  });
  if (!allowed) return apiError(429, "RATE_LIMITED", "Please wait before saving another offer.");
  const parsed = offerDraftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_OFFER", "Check the offer.", parsed.error.flatten().fieldErrors);
  const { data, error } = await saveProfessionalOffer(context, (await params).requestId, parsed.data);
  if (error || !data) return offerCommandError(error);
  return apiSuccess({ offer: data }, { status: 201 });
}
