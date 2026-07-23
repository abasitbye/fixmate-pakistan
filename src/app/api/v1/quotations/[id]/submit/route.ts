import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { executionCommandError } from "@/lib/marketplace/execution/api";
import { quotationSubmitSchema } from "@/lib/marketplace/execution/schemas";
import { submitQuotation } from "@/lib/marketplace/execution/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { parseIdempotencyKey } from "@/lib/marketplace/idempotency";
import { enforceMarketplaceRateLimit } from "@/lib/marketplace/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to submit this quotation.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Quotations are not available yet.");
  const limited = await enforceMarketplaceRateLimit({
    profileId: context.profile.id,
    scope: "marketplace.quotation.submit",
    limit: 20,
    windowSeconds: 3600,
  });
  if (limited) return limited;
  const parsed = quotationSubmitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_QUOTATION", "Refresh the quotation and try again.");
  let key: string; try { key = parseIdempotencyKey(request); } catch { return apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid action key is required."); }
  const { data, error } = await submitQuotation(context, (await params).id, parsed.data.version, key);
  if (error || !data) return executionCommandError(error);
  return apiSuccess({ quotation: data });
}
