import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { executionCommandError } from "@/lib/marketplace/execution/api";
import { quotationDraftSchema } from "@/lib/marketplace/execution/schemas";
import { getQuotation, saveQuotation } from "@/lib/marketplace/execution/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to view this quotation.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Quotations are not available yet.");
  const { data, error } = await getQuotation(context, (await params).id);
  if (error || !data) return apiError(404, "QUOTATION_NOT_FOUND", "The quotation was not found.");
  return apiSuccess({ quotation: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to edit this quotation.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Quotations are not available yet.");
  const parsed = quotationDraftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_QUOTATION", "Check the itemized quotation.", parsed.error.flatten().fieldErrors);
  const id = (await params).id;
  const current = await getQuotation(context, id);
  if (!current.data) return apiError(404, "QUOTATION_NOT_FOUND", "The quotation was not found.");
  const { data, error } = await saveQuotation(context, current.data.job_id, { ...parsed.data, quotationId: id });
  if (error || !data) return executionCommandError(error);
  return apiSuccess({ quotation: data });
}
