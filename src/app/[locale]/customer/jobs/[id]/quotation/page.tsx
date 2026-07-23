import { notFound, redirect } from "next/navigation";

import { ChangeOrderPanel } from "@/components/marketplace/change-order-panel";
import { QuotationList } from "@/components/marketplace/quotation-list";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { listJobChangeOrders, listJobQuotations } from "@/lib/marketplace/execution/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { getJob } from "@/lib/marketplace/jobs/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function CustomerQuotationPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: localeValue, id } = await params; const locale = localeValue as AppLocale;
  const context = await requireAccount(locale, ["customer"]);
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) redirect(localizedPath(locale, "/customer"));
  const job = await getJob(context, id); if (!job.data || job.data.customer_id !== context.profile.id) notFound();
  const [{ data: quotations }, { data: changes }] = await Promise.all([listJobQuotations(context, id), listJobChangeOrders(context, id)]);
  return <><div className="dashboard-heading"><div><span className="section-kicker">{job.data.job_reference}</span><h1>Commercial approvals</h1><p>Review immutable quotation versions and approve changed scope before covered work proceeds.</p></div></div><QuotationList quotations={(quotations ?? []) as unknown as Parameters<typeof QuotationList>[0]["quotations"]} role="customer" /><div className="admin-section"><h2>Change orders</h2><ChangeOrderPanel jobId={id} role="customer" changeOrders={(changes ?? []) as unknown as Parameters<typeof ChangeOrderPanel>[0]["changeOrders"]} /></div></>;
}
