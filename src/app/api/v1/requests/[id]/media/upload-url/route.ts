import { randomUUID } from "node:crypto";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { requestMediaPrepareSchema } from "@/lib/marketplace/requests/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to upload request media.");
  if (!await isMarketplaceFeatureEnabled("phase2.requests_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Service requests are not available yet.");
  }
  const requestId = (await params).id;
  const { data: serviceRequest } = await context.supabase
    .from("service_requests")
    .select("id,status")
    .eq("id", requestId)
    .eq("customer_id", context.profile.id)
    .single();
  if (!serviceRequest || serviceRequest.status !== "draft") {
    return apiError(409, "REQUEST_NOT_EDITABLE", "Media can only be added to a draft request.");
  }
  const parsed = requestMediaPrepareSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_MEDIA", "Use an accepted image or short video.", parsed.error.flatten().fieldErrors);
  const allowed = await consumeRateLimit({
    scope: "marketplace.request.media",
    identifier: context.profile.id,
    limit: 20,
    windowSeconds: 3600,
  });
  if (!allowed) return apiError(429, "RATE_LIMITED", "Please wait before uploading more files.");

  const storagePath = `${context.profile.id}/${requestId}/${randomUUID()}.${extensions[parsed.data.mimeType]}`;
  const { data, error } = await createAdminClient().storage
    .from("service-request-media")
    .createSignedUploadUrl(storagePath);
  if (error || !data) return apiError(500, "UPLOAD_URL_FAILED", "A secure upload could not be prepared.");
  return apiSuccess({ bucket: "service-request-media", storagePath, token: data.token });
}
