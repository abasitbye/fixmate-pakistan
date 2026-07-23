import { notFound, redirect } from "next/navigation";

import { JobDetail } from "@/components/marketplace/job-detail";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { getJob } from "@/lib/marketplace/jobs/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function CustomerJobPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: localeValue, id } = await params;
  const locale = localeValue as AppLocale;
  const context = await requireAccount(locale, ["customer"]);
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) redirect(localizedPath(locale, "/customer"));
  const result = await getJob(context, id);
  if (!result.data || result.data.customer_id !== context.profile.id) notFound();
  const { data: media } = await context.supabase.from("job_media").select("id,media_stage,media_type,mime_type,file_size,caption").eq("job_id", id).is("deleted_at", null).order("created_at");
  return <JobDetail
    job={result.data as unknown as Parameters<typeof JobDetail>[0]["job"]}
    role="customer"
    arrivalVerification={result.arrivalVerification}
    media={media ?? []}
  />;
}
