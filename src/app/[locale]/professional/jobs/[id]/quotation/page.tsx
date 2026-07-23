import { notFound, redirect } from "next/navigation";

import { QuotationForm } from "@/components/marketplace/quotation-form";
import { QuotationList } from "@/components/marketplace/quotation-list";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { listJobQuotations } from "@/lib/marketplace/execution/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { getJob } from "@/lib/marketplace/jobs/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function ProfessionalQuotationPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: localeValue, id } = await params; const locale = localeValue as AppLocale;
  const context = await requireAccount(locale, ["professional"]);
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) redirect(localizedPath(locale, "/professional"));
  const job = await getJob(context, id); if (!job.data || job.data.professional_id !== context.profile.id) notFound();
  const { data } = await listJobQuotations(context, id);
  const canCreate = ["arrived", "inspecting", "awaiting_quotation"].includes(job.data.status);
  return <><div className="dashboard-heading"><div><span className="section-kicker">{job.data.job_reference}</span><h1>Versioned quotations</h1><p>Each submitted version remains immutable and requires explicit customer approval.</p></div></div>{canCreate ? <QuotationForm jobId={id} /> : null}<QuotationList quotations={(data ?? []) as unknown as Parameters<typeof QuotationList>[0]["quotations"]} role="professional" /></>;
}
