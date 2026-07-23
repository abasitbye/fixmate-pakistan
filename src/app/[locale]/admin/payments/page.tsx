import { redirect } from "next/navigation";

import { FinancialRecordList } from "@/components/marketplace/financial-record-list";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { listPayments } from "@/lib/marketplace/payments/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function AdminPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["admin", "super_admin"]);
  if (!(await isMarketplaceFeatureEnabled("phase2.payments_enabled")))
    redirect(localizedPath(locale, "/admin"));
  const { data } = await listPayments(context);
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">Financial control</span>
          <h1>Marketplace payments</h1>
          <p>
            Auditable payment intents, settlement status, configured fees, and
            professional amounts.
          </p>
        </div>
      </div>
      <FinancialRecordList
        records={(data ?? []) as unknown as Array<Record<string, unknown>>}
        kind="payments"
      />
    </>
  );
}
