import "server-only";

import { redirect } from "next/navigation";

import type { AppLocale } from "@/i18n/routing";
import { localizedPath } from "@/lib/routing/localized-path";

import { getAuthenticatedContext, hasAnyRole } from "./session";

export async function requireAccount(locale: AppLocale, roles?: string[]) {
  const context = await getAuthenticatedContext();
  if (!context) redirect(localizedPath(locale, "/auth/sign-in"));
  if (context.profile.account_status !== "active") redirect(localizedPath(locale, "/auth/restricted"));
  if (!context.profile.onboarding_completed_at) {
    redirect(localizedPath(locale, context.profile.display_name ? "/auth/account-purpose" : "/auth/complete-profile"));
  }
  if (roles && !hasAnyRole(context.roles, roles)) redirect(localizedPath(locale, "/auth/unauthorized"));
  return context;
}
