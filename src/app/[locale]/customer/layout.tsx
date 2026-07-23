import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { getMarketplaceFlags } from "@/lib/marketplace/feature-flags";

export default async function CustomerLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["customer", "professional", "support", "admin", "super_admin"]);
  const flags = await getMarketplaceFlags();
  const marketplace = flags["phase2.marketplace_enabled"];
  return <DashboardShell
    displayName={context.profile.display_name}
    roles={context.roles}
    marketplaceNavigation={{
      requests: marketplace && flags["phase2.requests_enabled"],
      matching: marketplace && flags["phase2.matching_enabled"],
      jobs: marketplace && flags["phase2.jobs_enabled"],
    }}
  >{children}</DashboardShell>;
}
