import { apiError, apiSuccess } from "@/lib/api/response";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { jobCommandError } from "@/lib/marketplace/jobs/api";
import { getJob, jobParticipantRole, regenerateArrivalCode } from "@/lib/marketplace/jobs/service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to generate an arrival code.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Arrival verification is not available yet.");
  }
  const { id } = await params;
  const job = await getJob(context, id);
  if (!job.data) return apiError(404, "JOB_NOT_FOUND", "The job was not found.");
  if (jobParticipantRole(context, job.data) !== "customer") {
    return apiError(403, "FORBIDDEN", "Only the customer can generate this code.");
  }
  const allowed = await consumeRateLimit({
    scope: "arrival_code_regenerate",
    identifier: `${context.profile.id}:${id}`,
    limit: 5,
    windowSeconds: 900,
  });
  if (!allowed) return apiError(429, "RATE_LIMITED", "Wait before generating another arrival code.");
  const { data, error } = await regenerateArrivalCode(context, id);
  if (error || !data?.length) return jobCommandError(error);
  return apiSuccess({
    verificationId: data[0].verification_id,
    arrivalCode: data[0].arrival_code,
    expiresAt: data[0].expires_at,
  });
}
