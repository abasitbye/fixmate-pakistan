import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { offerCommandError } from "@/lib/marketplace/offers/api";
import { offerDraftSchema } from "@/lib/marketplace/offers/schemas";
import { saveProfessionalOffer } from "@/lib/marketplace/offers/service";

const schema = offerDraftSchema.and(z.object({ requestId: z.uuid(), version: z.number().int().positive() }));

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to edit this offer.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.matching_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Professional offers are not available yet.");
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_OFFER", "Check the offer.", parsed.error.flatten().fieldErrors);
  const { requestId, version, ...offer } = parsed.data;
  const { data, error } = await saveProfessionalOffer(context, requestId, offer, (await params).id, version);
  if (error || !data) return offerCommandError(error);
  return apiSuccess({ offer: data });
}
