import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { declineInvitation } from "@/lib/marketplace/matching/service";

const schema = z.object({ reason: z.string().trim().min(3).max(1000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to decline this invitation.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.matching_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Professional matching is not available yet.");
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "DECLINE_REASON_REQUIRED", "Provide a brief reason.");
  const { data, error } = await declineInvitation(context, (await params).id, parsed.data.reason);
  if (error || !data) return apiError(409, "INVITATION_NOT_DECLINABLE", "The invitation is unavailable.");
  return apiSuccess({ invitation: data });
}
