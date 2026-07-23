import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { jobMediaFinalizeSchema } from "@/lib/marketplace/execution/schemas";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to view job evidence.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Job evidence is not available yet.");
  const id = (await params).id;
  const { data, error } = await context.supabase.from("job_media")
    .select("id,media_stage,media_type,mime_type,file_size,caption,taken_at,created_at,storage_path")
    .eq("job_id", id).is("deleted_at", null).order("created_at", { ascending: true });
  if (error) return apiError(404, "JOB_NOT_FOUND", "The job evidence was not found.");
  const admin = createAdminClient();
  const media = await Promise.all((data ?? []).map(async (item) => {
    const { data: signed } = await admin.storage.from("job-evidence").createSignedUrl(item.storage_path, 300);
    const { storage_path: _storagePath, ...safe } = item;
    void _storagePath;
    return { ...safe, signedUrl: signed?.signedUrl ?? null };
  }));
  return apiSuccess({ media });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to save job evidence.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Job evidence is not available yet.");
  const parsed = jobMediaFinalizeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_MEDIA", "Check the uploaded evidence.", parsed.error.flatten().fieldErrors);
  const id = (await params).id;
  if (!parsed.data.storagePath.startsWith(`${context.profile.id}/${id}/`)) return apiError(403, "INVALID_STORAGE_PATH", "The upload path is not owned by this job.");
  const admin = createAdminClient();
  const { data: job } = await admin.from("jobs").select("id,customer_id,professional_id").eq("id", id).single();
  if (!job || (job.customer_id !== context.profile.id && job.professional_id !== context.profile.id)) return apiError(404, "JOB_NOT_FOUND", "The job was not found.");
  const { error: objectError } = await admin.storage.from("job-evidence").createSignedUrl(parsed.data.storagePath, 60);
  if (objectError) return apiError(400, "UPLOAD_NOT_FOUND", "Complete the secure upload before saving it.");
  const { data, error } = await admin.from("job_media").insert({
    job_id: id, uploaded_by: context.profile.id, media_stage: parsed.data.mediaStage,
    media_type: parsed.data.mediaType, storage_path: parsed.data.storagePath,
    mime_type: parsed.data.mimeType, file_size: parsed.data.sizeBytes,
    caption: parsed.data.caption || null, taken_at: parsed.data.takenAt ?? null,
  }).select("id,media_stage,media_type,mime_type,file_size,caption,created_at").single();
  if (error || !data) return apiError(500, "MEDIA_SAVE_FAILED", "The uploaded evidence could not be recorded.");
  return apiSuccess({ media: data }, { status: 201 });
}
