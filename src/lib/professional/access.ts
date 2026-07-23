import "server-only";

import type { AwaitedAuthenticatedContext } from "./types";

export const editableApplicationStatuses = ["draft", "changes_requested"] as const;

export async function getProfessionalApplication(context: AwaitedAuthenticatedContext) {
  const { data, error } = await context.supabase.from("professional_profiles").select("*").eq("user_profile_id", context.profile.id).single();
  if (error || !data) return null;
  return data;
}

export async function ensureEditableApplication(context: AwaitedAuthenticatedContext) {
  const application = await getProfessionalApplication(context);
  if (!application || !editableApplicationStatuses.includes(application.application_status as (typeof editableApplicationStatuses)[number])) return null;
  return application;
}
