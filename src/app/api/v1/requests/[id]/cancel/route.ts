import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { parseIdempotencyKey } from "@/lib/marketplace/idempotency";
import { requestCommandError } from "@/lib/marketplace/requests/api";
import { requestCancelSchema } from "@/lib/marketplace/requests/schemas";
import { cancelCustomerRequest } from "@/lib/marketplace/requests/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to cancel this request.");
  if (!await isMarketplaceFeatureEnabled("phase2.requests_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Service requests are not available yet.");
  }
  const parsed = requestCancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_CANCELLATION", "Provide a cancellation reason.");
  let key: string;
  try {
    key = parseIdempotencyKey(request);
  } catch {
    return apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid action key is required.");
  }
  const { data, error } = await cancelCustomerRequest(
    context,
    (await params).id,
    parsed.data.version,
    parsed.data.reason,
    key,
  );
  if (error || !data) return requestCommandError(error);
  return apiSuccess({ request: data });
}
