import { notFound, redirect } from "next/navigation";

import { JobDetail } from "@/components/marketplace/job-detail";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { getBooking } from "@/lib/marketplace/bookings/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { getJob } from "@/lib/marketplace/jobs/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function ProfessionalJobPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: localeValue, id } = await params;
  const locale = localeValue as AppLocale;
  const context = await requireAccount(locale, ["professional"]);
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) redirect(localizedPath(locale, "/professional"));
  const result = await getJob(context, id);
  if (!result.data || result.data.professional_id !== context.profile.id) notFound();
  const booking = await getBooking(context, result.data.booking_id);
  const { data: media } = await context.supabase.from("job_media").select("id,media_stage,media_type,mime_type,file_size,caption").eq("job_id", id).is("deleted_at", null).order("created_at");
  return <JobDetail
    job={result.data as unknown as Parameters<typeof JobDetail>[0]["job"]}
    role="professional"
    exactAddress={booking.exactAddress}
    media={media ?? []}
  />;
}
