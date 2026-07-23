import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  if (error || !subject) return null;

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id,email,display_name,phone,preferred_locale,account_status,onboarding_completed_at")
    .eq("auth_user_id", subject)
    .single();
  if (profileError || !profile) return null;

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("is_active,roles(code)")
    .eq("user_profile_id", profile.id)
    .eq("is_active", true);

  const roles = (roleRows ?? [])
    .map((row) => {
      const role = row.roles as unknown as { code?: string } | null;
      return role?.code;
    })
    .filter((role): role is string => Boolean(role));

  return { supabase, userId: subject, profile, roles };
}

export function hasAnyRole(actual: string[], expected: string[]) {
  return expected.some((role) => actual.includes(role));
}
