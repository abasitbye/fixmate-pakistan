import { randomUUID } from "node:crypto";

import { apiError, apiSuccess } from "@/lib/api/response";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { jobMediaPrepareSchema } from "@/lib/marketplace/execution/schemas";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";

const extensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "video/mp4": "mp4", "video/webm": "webm", "application/pdf": "pdf",
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to upload job evidence.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Job evidence is not available yet.");
  const parsed = jobMediaPrepareSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_MEDIA", "Use an accepted image, short video, or PDF.");
  const id = (await params).id;
  const { data: job } = await context.supabase.from("jobs").select("id,customer_id,professional_id").eq("id", id).single();
  if (!job) return apiError(404, "JOB_NOT_FOUND", "The job was not found.");
  const allowed = await consumeRateLimit({ scope: "job_evidence_upload", identifier: `${context.profile.id}:${id}`, limit: 30, windowSeconds: 3600 });
  if (!allowed) return apiError(429, "RATE_LIMITED", "Please wait before uploading more job evidence.");
  const storagePath = `${context.profile.id}/${id}/${randomUUID()}.${extensions[parsed.data.mimeType]}`;
  const { data, error } = await createAdminClient().storage.from("job-evidence").createSignedUploadUrl(storagePath);
  if (error || !data) return apiError(500, "UPLOAD_URL_FAILED", "A secure upload could not be prepared.");
  return apiSuccess({ bucket: "job-evidence", storagePath, token: data.token });
}
