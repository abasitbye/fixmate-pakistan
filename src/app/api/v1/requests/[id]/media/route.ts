import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { requestMediaFinalizeSchema } from "@/lib/marketplace/requests/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to finalize request media.");
  if (!await isMarketplaceFeatureEnabled("phase2.requests_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Service requests are not available yet.");
  }
  const requestId = (await params).id;
  const parsed = requestMediaFinalizeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_MEDIA", "Check the uploaded media.", parsed.error.flatten().fieldErrors);
  const ownedPrefix = `${context.profile.id}/${requestId}/`;
  if (!parsed.data.storagePath.startsWith(ownedPrefix)) {
    return apiError(403, "INVALID_STORAGE_PATH", "The upload path is not owned by this request.");
  }
  const admin = createAdminClient();
  const { data: serviceRequest } = await admin
    .from("service_requests")
    .select("id,status")
    .eq("id", requestId)
    .eq("customer_id", context.profile.id)
    .single();
  if (!serviceRequest || serviceRequest.status !== "draft") {
    return apiError(409, "REQUEST_NOT_EDITABLE", "Media can only be added to a draft request.");
  }
  const { error: objectError } = await admin.storage
    .from("service-request-media")
    .createSignedUrl(parsed.data.storagePath, 60);
  if (objectError) return apiError(400, "UPLOAD_NOT_FOUND", "Complete the secure upload before saving it.");
  const { data, error } = await admin.from("service_request_media").insert({
    request_id: requestId,
    uploaded_by: context.profile.id,
    media_type: parsed.data.mediaType,
    storage_path: parsed.data.storagePath,
    mime_type: parsed.data.mimeType,
    file_size: parsed.data.sizeBytes,
    width: parsed.data.width,
    height: parsed.data.height,
    duration_seconds: parsed.data.durationSeconds,
    caption: parsed.data.caption,
  }).select("id,media_type,mime_type,file_size,caption,created_at").single();
  if (error) return apiError(500, "MEDIA_SAVE_FAILED", "The uploaded media could not be recorded.");
  return apiSuccess({ media: data }, { status: 201 });
}
