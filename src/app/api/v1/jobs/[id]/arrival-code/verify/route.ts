import { apiError, apiSuccess } from "@/lib/api/response";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { jobCommandError } from "@/lib/marketplace/jobs/api";
import { arrivalCodeSchema } from "@/lib/marketplace/jobs/schemas";
import { verifyArrivalCode } from "@/lib/marketplace/jobs/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to verify arrival.");
  if (!context.roles.includes("professional")) return apiError(403, "FORBIDDEN", "Professional access is required.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) {
    return apiError(404, "FEATURE_NOT_AVAILABLE", "Arrival verification is not available yet.");
  }
  const parsed = arrivalCodeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_ARRIVAL_CODE_FORMAT", "Enter the six-digit arrival code.");
  const { id } = await params;
  const allowed = await consumeRateLimit({
    scope: "arrival_code_verify",
    identifier: `${context.profile.id}:${id}`,
    limit: 10,
    windowSeconds: 900,
  });
  if (!allowed) return apiError(429, "RATE_LIMITED", "Too many arrival verification attempts.");
  const { data, error } = await verifyArrivalCode(context, id, parsed.data.code);
  if (error || !data?.length) return jobCommandError(error);
  const result = data[0];
  if (result.verification_status === "invalid") {
    return apiError(400, "ARRIVAL_CODE_INVALID", `The code is incorrect. ${result.attempts_remaining} attempts remain.`);
  }
  if (result.verification_status === "locked") {
    return apiError(429, "ARRIVAL_CODE_LOCKED", "The arrival code is locked. Ask the customer to generate a new one.");
  }
  if (result.verification_status === "expired") {
    return apiError(410, "ARRIVAL_CODE_EXPIRED", "The arrival code expired. Ask the customer to generate a new one.");
  }
  return apiSuccess({
    verificationStatus: result.verification_status,
    jobId: result.verified_job_id,
    jobStatus: result.verified_job_status,
  });
}
