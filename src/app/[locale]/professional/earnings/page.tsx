import { redirect } from "next/navigation";

import { FinancialRecordList } from "@/components/marketplace/financial-record-list";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { listEarnings } from "@/lib/marketplace/payments/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function ProfessionalEarningsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["professional"]);
  if (!(await isMarketplaceFeatureEnabled("phase2.payments_enabled")))
    redirect(localizedPath(locale, "/professional"));
  const { data } = await listEarnings(context);
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">Marketplace accounting</span>
          <h1>Your earnings</h1>
          <p>
            Gross amount, configured platform fee, adjustments, net earnings,
            and payout state.
          </p>
        </div>
      </div>
      <FinancialRecordList
        records={(data ?? []) as unknown as Array<Record<string, unknown>>}
        kind="earnings"
      />
    </>
  );
}
