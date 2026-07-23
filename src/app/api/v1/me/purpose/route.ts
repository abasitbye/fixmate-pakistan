import { apiError, apiSuccess } from "@/lib/api/response";
import { accountPurposeSchema } from "@/lib/auth/schemas";
import { getAuthenticatedContext } from "@/lib/auth/session";

export async function POST(request: Request) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (context.profile.account_status !== "active") return apiError(403, "ACCOUNT_RESTRICTED", "This account is restricted.");

  const parsed = accountPurposeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_PURPOSE", "Choose how you plan to use FixMate.");

  let next = "/customer";
  if (parsed.data.purpose === "professional") {
    const { error } = await context.supabase.rpc("create_professional_draft");
    if (error) return apiError(500, "APPLICATION_CREATE_FAILED", "Your professional application could not be started.");
    next = "/professional/application";
  }

  const { error: profileError } = await context.supabase
    .from("user_profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", context.profile.id);
  if (profileError) return apiError(500, "ONBOARDING_UPDATE_FAILED", "Your selection could not be saved.");

  return apiSuccess({ next });
}
