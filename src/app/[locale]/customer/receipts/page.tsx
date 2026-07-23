import { redirect } from "next/navigation";

import { FinancialRecordList } from "@/components/marketplace/financial-record-list";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { listReceipts } from "@/lib/marketplace/payments/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function CustomerReceiptsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["customer"]);
  if (!(await isMarketplaceFeatureEnabled("phase2.payments_enabled")))
    redirect(localizedPath(locale, "/customer"));
  const { data } = await listReceipts(context);
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">Documents</span>
          <h1>Receipts and acknowledgements</h1>
          <p>
            Accurate settlement records. Documents are not labelled as tax
            invoices without authorized tax configuration.
          </p>
        </div>
      </div>
      <FinancialRecordList
        records={(data ?? []) as unknown as Array<Record<string, unknown>>}
        kind="receipts"
      />
    </>
  );
}
