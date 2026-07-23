import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";

export async function GET() {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Your session has expired.");
  if (context.profile.account_status !== "active") return apiError(403, "ACCOUNT_RESTRICTED", "This account is restricted.");

  return apiSuccess({
    profile: context.profile,
    roles: context.roles,
  });
}
