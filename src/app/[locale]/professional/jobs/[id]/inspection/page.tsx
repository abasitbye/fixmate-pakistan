import { notFound, redirect } from "next/navigation";

import { InspectionPanel } from "@/components/marketplace/inspection-panel";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { getJob } from "@/lib/marketplace/jobs/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function InspectionPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: localeValue, id } = await params; const locale = localeValue as AppLocale;
  const context = await requireAccount(locale, ["professional"]);
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) redirect(localizedPath(locale, "/professional"));
  const job = await getJob(context, id);
  if (!job.data || job.data.professional_id !== context.profile.id) notFound();
  const { data: inspection } = await context.supabase.from("job_inspections").select("id,status,version,findings,recommended_work,safety_notes").eq("job_id", id).maybeSingle();
  return <><div className="dashboard-heading"><div><span className="section-kicker">{job.data.job_reference}</span><h1>Inspection</h1><p>Record findings and safety concerns before preparing the itemized quotation.</p></div></div><InspectionPanel jobId={id} jobStatus={job.data.status} jobVersion={job.data.version} inspection={inspection} /></>;
}
