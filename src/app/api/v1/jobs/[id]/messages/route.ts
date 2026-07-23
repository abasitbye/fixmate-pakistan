import { apiError, apiSuccess } from "@/lib/api/response";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { executionCommandError } from "@/lib/marketplace/execution/api";
import { jobMessageSchema } from "@/lib/marketplace/execution/schemas";
import { listJobMessages, sendJobMessage } from "@/lib/marketplace/execution/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to view job messages.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Job chat is not available yet.");
  const { data, error } = await listJobMessages(context, (await params).id);
  if (error) return apiError(404, "JOB_NOT_FOUND", "The job conversation was not found.");
  return apiSuccess({ messages: data });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to send a job message.");
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) return apiError(404, "FEATURE_NOT_AVAILABLE", "Job chat is not available yet.");
  const parsed = jobMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_MESSAGE", "Enter a plain-text message up to 4,000 characters.");
  const allowed = await consumeRateLimit({ scope: "job_chat", identifier: `${context.profile.id}:${(await params).id}`, limit: 30, windowSeconds: 300 });
  if (!allowed) return apiError(429, "RATE_LIMITED", "Please wait before sending more job messages.");
  const id = (await params).id;
  const { data, error } = await sendJobMessage(context, id, parsed.data.body, parsed.data.replyToMessageId);
  if (error || !data) return executionCommandError(error);
  return apiSuccess({ message: data }, { status: 201 });
}
