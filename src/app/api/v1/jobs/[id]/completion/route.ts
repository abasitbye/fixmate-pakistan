import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { executionCommandError } from "@/lib/marketplace/execution/api";
import { completionSubmitSchema } from "@/lib/marketplace/execution/schemas";
import { submitCompletion } from "@/lib/marketplace/execution/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to submit completion.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Completion is not available yet.");
  const parsed = completionSubmitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_COMPLETION", "Add a complete work summary.", parsed.error.flatten().fieldErrors);
  const { data, error } = await submitCompletion(context, (await params).id, parsed.data.version, parsed.data.summary, parsed.data.outstandingNotes);
  if (error || !data) return executionCommandError(error);
  return apiSuccess({ completion: data });
}
