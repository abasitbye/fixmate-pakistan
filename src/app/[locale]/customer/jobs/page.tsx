import { Wrench } from "lucide-react";
import { redirect } from "next/navigation";

import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { listJobs } from "@/lib/marketplace/jobs/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function CustomerJobsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["customer"]);
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) redirect(localizedPath(locale, "/customer"));
  const { data } = await listJobs(context);
  const jobs = (data ?? []).filter((job) => job.customer_id === context.profile.id);
  return <>
    <div className="dashboard-heading"><div><span className="section-kicker">Service delivery</span><h1>Your jobs</h1><p>Track travel, consent-limited location, verified arrival, and the service lifecycle.</p></div></div>
    <div className="card-list">
      {jobs.map((job) => {
        const request = Array.isArray(job.service_requests) ? job.service_requests[0] : job.service_requests;
        return <Link className="panel-card setting-row" href={`/customer/jobs/${job.id}`} key={job.id}><span className="panel-icon"><Wrench size={20} /></span><div><h2>{request?.title ?? "Service job"}</h2><p>{job.job_reference} · {new Date(job.scheduled_start_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</p></div><span className="status-chip">{job.status.replaceAll("_", " ")}</span></Link>;
      })}
      {!jobs.length ? <article className="panel-card"><h2>No active jobs</h2><p>A job is created after the selected professional confirms your booking.</p></article> : null}
    </div>
  </>;
}
