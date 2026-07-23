import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { requestCommandError } from "@/lib/marketplace/requests/api";
import { requestUpdateSchema } from "@/lib/marketplace/requests/schemas";
import {
  getCustomerRequest,
  updateCustomerRequest,
} from "@/lib/marketplace/requests/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to view this request.");
  if (!await isMarketplaceFeatureEnabled("phase2.requests_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Service requests are not available yet.");
  }
  const { data, error } = await getCustomerRequest(context, (await params).id);
  if (error || !data) return apiError(404, "REQUEST_NOT_FOUND", "The service request was not found.");
  return apiSuccess({ request: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to edit this request.");
  if (!await isMarketplaceFeatureEnabled("phase2.requests_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Service requests are not available yet.");
  }
  const parsed = requestUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "INVALID_REQUEST", "Check the service request.", parsed.error.flatten().fieldErrors);
  }
  const { data, error } = await updateCustomerRequest(context, (await params).id, parsed.data);
  if (error || !data) return requestCommandError(error);
  return apiSuccess({ request: data });
}
