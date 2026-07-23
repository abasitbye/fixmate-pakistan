import { notFound, redirect } from "next/navigation";
import { CompletionForm } from "@/components/marketplace/completion-form";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { getJob } from "@/lib/marketplace/jobs/service";
import { localizedPath } from "@/lib/routing/localized-path";
export default async function Page({params}:{params:Promise<{locale:string;id:string}>}){const{locale:localeValue,id}=await params;const locale=localeValue as AppLocale;const context=await requireAccount(locale,["professional"]);if(!await isMarketplaceFeatureEnabled("phase2.jobs_enabled"))redirect(localizedPath(locale,"/professional"));const job=await getJob(context,id);if(!job.data||job.data.professional_id!==context.profile.id)notFound();return <><div className="dashboard-heading"><div><span className="section-kicker">{job.data.job_reference}</span><h1>Completion submission</h1></div></div><CompletionForm jobId={id} version={job.data.version}/></>}
