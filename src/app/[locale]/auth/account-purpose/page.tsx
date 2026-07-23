import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { PurposeForm } from "@/components/auth/purpose-form";
import type { AppLocale } from "@/i18n/routing";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { localizedPath } from "@/lib/routing/localized-path";

export const metadata: Metadata = { title: "Choose account purpose", robots: { index: false, follow: false } };

export default async function AccountPurposePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as AppLocale;
  const context = await getAuthenticatedContext();
  if (!context) redirect(localizedPath(locale, "/auth/sign-in"));
  if (context.profile.account_status !== "active") redirect(localizedPath(locale, "/auth/restricted"));
  if (!context.profile.display_name) redirect(localizedPath(locale, "/auth/complete-profile"));
  if (context.profile.onboarding_completed_at) redirect(localizedPath(locale, "/customer"));

  return (
    <AuthShell eyebrow="Personalized setup" title="Choose your starting point." lead="Providing services begins a private application. It does not create a public profile until FixMate reviews and approves it.">
      <PurposeForm />
    </AuthShell>
  );
}
