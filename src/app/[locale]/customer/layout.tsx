import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";

export default async function CustomerLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["customer", "professional", "support", "admin", "super_admin"]);
  return <DashboardShell displayName={context.profile.display_name} roles={context.roles}>{children}</DashboardShell>;
}
