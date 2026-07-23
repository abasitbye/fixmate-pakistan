import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { getMarketplaceFlags } from "@/lib/marketplace/feature-flags";

export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["admin", "super_admin"]);
  const flags = await getMarketplaceFlags();
  const marketplace = flags["phase2.marketplace_enabled"];
  return <DashboardShell
    displayName={context.profile.display_name}
    roles={context.roles}
    section="admin"
    marketplaceNavigation={{
      requests: marketplace && flags["phase2.requests_enabled"],
      matching: marketplace && flags["phase2.matching_enabled"],
      jobs: marketplace && flags["phase2.jobs_enabled"],
      payments: marketplace && flags["phase2.payments_enabled"],
      resolution: marketplace && flags["phase2.resolution_enabled"],
    }}
  >{children}</DashboardShell>;
}
