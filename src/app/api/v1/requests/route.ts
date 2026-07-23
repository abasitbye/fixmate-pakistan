import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { parseIdempotencyKey } from "@/lib/marketplace/idempotency";
import { requestCommandError } from "@/lib/marketplace/requests/api";
import { requestDraftSchema } from "@/lib/marketplace/requests/schemas";
import {
  createCustomerRequest,
  listCustomerRequests,
} from "@/lib/marketplace/requests/service";

export async function GET() {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to view service requests.");
  if (!await isMarketplaceFeatureEnabled("phase2.requests_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Service requests are not available yet.");
  }
  const { data, error } = await listCustomerRequests(context);
  if (error) return apiError(500, "REQUESTS_LOAD_FAILED", "Your service requests could not be loaded.");
  return apiSuccess({ requests: data });
}

export async function POST(request: Request) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to create a service request.");
  if (context.profile.account_status !== "active") {
    return apiError(403, "ACCOUNT_RESTRICTED", "This account is restricted.");
  }
  if (!await isMarketplaceFeatureEnabled("phase2.requests_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Service requests are not available yet.");
  }
  const allowed = await consumeRateLimit({
    scope: "marketplace.request.create",
    identifier: context.profile.id,
    limit: 10,
    windowSeconds: 3600,
  });
  if (!allowed) return apiError(429, "RATE_LIMITED", "Please wait before creating another request.");

  let idempotencyKey: string;
  try {
    idempotencyKey = parseIdempotencyKey(request);
  } catch {
    return apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid action key is required.");
  }

  const parsed = requestDraftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "INVALID_REQUEST", "Check the service request.", parsed.error.flatten().fieldErrors);
  }
  const { data, error } = await createCustomerRequest(context, parsed.data, idempotencyKey);
  if (error || !data) return requestCommandError(error);
  return apiSuccess({ request: data }, { status: 201 });
}
