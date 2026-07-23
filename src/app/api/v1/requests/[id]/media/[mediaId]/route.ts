import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to remove request media.");
  if (!await isMarketplaceFeatureEnabled("phase2.requests_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Service requests are not available yet.");
  }
  const { id, mediaId } = await params;
  const admin = createAdminClient();
  const { data: media } = await admin.from("service_request_media")
    .select("id,storage_path,service_requests!inner(customer_id,status)")
    .eq("id", mediaId)
    .eq("request_id", id)
    .single();
  const parent = media?.service_requests as unknown as { customer_id?: string; status?: string } | null;
  if (!media || parent?.customer_id !== context.profile.id) {
    return apiError(404, "MEDIA_NOT_FOUND", "The request media was not found.");
  }
  if (parent?.status !== "draft") return apiError(409, "REQUEST_NOT_EDITABLE", "Submitted request media cannot be removed.");
  const { error } = await admin.from("service_request_media")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", mediaId);
  if (error) return apiError(500, "MEDIA_DELETE_FAILED", "The media could not be removed.");
  await admin.storage.from("service-request-media").remove([media.storage_path]);
  return apiSuccess({ deleted: true });
}
