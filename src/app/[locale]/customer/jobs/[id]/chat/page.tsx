import { notFound, redirect } from "next/navigation";
import { JobChat } from "@/components/marketplace/job-chat";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { listJobMessages } from "@/lib/marketplace/execution/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { getJob } from "@/lib/marketplace/jobs/service";
import { localizedPath } from "@/lib/routing/localized-path";
export default async function Page({params}:{params:Promise<{locale:string;id:string}>}){const{locale:localeValue,id}=await params;const locale=localeValue as AppLocale;const context=await requireAccount(locale,["customer"]);if(!await isMarketplaceFeatureEnabled("phase2.jobs_enabled"))redirect(localizedPath(locale,"/customer"));const job=await getJob(context,id);if(!job.data||job.data.customer_id!==context.profile.id)notFound();const{data}=await listJobMessages(context,id);return <><div className="dashboard-heading"><div><span className="section-kicker">{job.data.job_reference}</span><h1>Job chat</h1></div></div><JobChat jobId={id} profileId={context.profile.id} messages={(data??[]) as unknown as Parameters<typeof JobChat>[0]["messages"]}/></>}
