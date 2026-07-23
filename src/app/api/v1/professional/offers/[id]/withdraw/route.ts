import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { offerCommandError } from "@/lib/marketplace/offers/api";
import { offerWithdrawSchema } from "@/lib/marketplace/offers/schemas";
import { withdrawProfessionalOffer } from "@/lib/marketplace/offers/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to withdraw this offer.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.matching_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Professional offers are not available yet.");
  }
  const parsed = offerWithdrawSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_WITHDRAWAL", "Provide the offer version and reason.");
  const { data, error } = await withdrawProfessionalOffer(
    context,
    (await params).id,
    parsed.data.version,
    parsed.data.reason,
  );
  if (error || !data) return offerCommandError(error);
  return apiSuccess({ offer: data });
}
