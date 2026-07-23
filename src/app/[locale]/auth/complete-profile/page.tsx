import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { ProfileForm } from "@/components/auth/profile-form";
import { routing, type AppLocale } from "@/i18n/routing";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { localizedPath } from "@/lib/routing/localized-path";

export const metadata: Metadata = { title: "Complete your profile", robots: { index: false, follow: false } };

export default async function CompleteProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as AppLocale;
  if (!routing.locales.includes(locale)) redirect("/");
  const context = await getAuthenticatedContext();
  if (!context) redirect(localizedPath(locale, "/auth/sign-in"));
  if (context.profile.account_status !== "active") redirect(localizedPath(locale, "/auth/restricted"));
  if (context.profile.onboarding_completed_at) redirect(localizedPath(locale, "/customer"));

  return (
    <AuthShell eyebrow="Account setup" title="A useful profile, with only what we need." lead="Your details stay protected by row-level access rules and are never exposed in public professional listings.">
      <ProfileForm locale={locale} />
    </AuthShell>
  );
}
