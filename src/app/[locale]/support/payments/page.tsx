import { redirect } from "next/navigation";

import { FinancialRecordList } from "@/components/marketplace/financial-record-list";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { listPayments } from "@/lib/marketplace/payments/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function SupportPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, [
    "support",
    "admin",
    "super_admin",
  ]);
  if (!(await isMarketplaceFeatureEnabled("phase2.payments_enabled")))
    redirect(localizedPath(locale, "/support"));
  const { data } = await listPayments(context);
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">Payment operations</span>
          <h1>Payment search</h1>
          <p>
            Review provider-neutral payment status. Disagreements require
            documented reconciliation.
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
