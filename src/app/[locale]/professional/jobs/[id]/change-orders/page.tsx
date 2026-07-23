import { notFound, redirect } from "next/navigation";

import { ChangeOrderPanel } from "@/components/marketplace/change-order-panel";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { listJobChangeOrders } from "@/lib/marketplace/execution/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { getJob } from "@/lib/marketplace/jobs/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function ChangeOrdersPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: localeValue, id } = await params; const locale = localeValue as AppLocale;
  const context = await requireAccount(locale, ["professional"]);
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) redirect(localizedPath(locale, "/professional"));
  const job = await getJob(context, id); if (!job.data || job.data.professional_id !== context.profile.id) notFound();
  const { data } = await listJobChangeOrders(context, id);
  return <><div className="dashboard-heading"><div><span className="section-kicker">{job.data.job_reference}</span><h1>Change orders</h1><p>Use explicit approval when scope, price, materials, or schedule changes.</p></div></div><ChangeOrderPanel jobId={id} role="professional" changeOrders={(data ?? []) as unknown as Parameters<typeof ChangeOrderPanel>[0]["changeOrders"]} /></>;
}
