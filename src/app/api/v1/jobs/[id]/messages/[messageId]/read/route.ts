import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { executionCommandError } from "@/lib/marketplace/execution/api";
import { markJobMessageRead } from "@/lib/marketplace/execution/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

export async function POST(_: Request, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to update message state.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Job chat is not available yet.");
  const { id, messageId } = await params;
  const { data, error } = await markJobMessageRead(context, id, messageId);
  if (error || !data) return executionCommandError(error);
  return apiSuccess({ read: data });
}
