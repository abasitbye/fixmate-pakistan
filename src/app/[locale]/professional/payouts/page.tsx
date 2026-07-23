import { redirect } from "next/navigation";

import { FinancialRecordList } from "@/components/marketplace/financial-record-list";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { listPayouts } from "@/lib/marketplace/payments/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function ProfessionalPayoutsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["professional"]);
  if (!(await isMarketplaceFeatureEnabled("phase2.payments_enabled")))
    redirect(localizedPath(locale, "/professional"));
  const { data } = await listPayouts(context);
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">Settlements</span>
          <h1>Your payouts</h1>
          <p>
            Manual payouts appear only after staff approval, evidence, and
            settlement recording. Live automated payouts are not enabled.
          </p>
        </div>
      </div>
      <FinancialRecordList
        records={(data ?? []) as unknown as Array<Record<string, unknown>>}
        kind="payouts"
      />
    </>
  );
}
