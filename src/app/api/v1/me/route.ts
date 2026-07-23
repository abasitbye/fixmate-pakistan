import { apiError, apiSuccess } from "@/lib/api/response";
import { profileSchema } from "@/lib/auth/schemas";
import { getAuthenticatedContext } from "@/lib/auth/session";

export async function GET() {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return apiSuccess({ profile: context.profile, roles: context.roles });
}

export async function PATCH(request: Request) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (context.profile.account_status !== "active") return apiError(403, "ACCOUNT_RESTRICTED", "This account is restricted.");

  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "INVALID_PROFILE", "Check the highlighted profile information.", parsed.error.flatten().fieldErrors);
  }

  const { error: profileError } = await context.supabase
    .from("user_profiles")
    .update({
      display_name: parsed.data.displayName,
      phone: parsed.data.phone,
      preferred_locale: parsed.data.preferredLocale,
    })
    .eq("id", context.profile.id);
  if (profileError) return apiError(500, "PROFILE_UPDATE_FAILED", "Your profile could not be saved.");

  const { data: consentTypes, error: consentError } = await context.supabase
    .from("consent_types")
    .select("id,current_version")
    .eq("is_required", true)
    .eq("is_active", true);
  if (consentError) return apiError(500, "CONSENT_LOAD_FAILED", "Required policies could not be recorded.");

  if (consentTypes.length > 0) {
    const { error: recordError } = await context.supabase.from("user_consents").upsert(
      consentTypes.map((consent) => ({
        user_profile_id: context.profile.id,
        consent_type_id: consent.id,
        version: consent.current_version,
        accepted: true,
      })),
      { onConflict: "user_profile_id,consent_type_id,version" },
    );
    if (recordError) return apiError(500, "CONSENT_SAVE_FAILED", "Required policies could not be recorded.");
  }

  return apiSuccess({ saved: true });
}
