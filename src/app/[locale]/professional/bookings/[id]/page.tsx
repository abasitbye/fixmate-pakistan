import { notFound, redirect } from "next/navigation";

import { BookingDetail } from "@/components/marketplace/booking-detail";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { getBooking } from "@/lib/marketplace/bookings/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function ProfessionalBookingPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: localeValue, id } = await params;
  const locale = localeValue as AppLocale;
  const context = await requireAccount(locale, ["professional"]);
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) redirect(localizedPath(locale, "/professional"));
  const result = await getBooking(context, id);
  if (!result.data || result.data.professional_id !== context.profile.id) notFound();
  const { data: job } = await context.supabase.from("jobs").select("id").eq("booking_id", id).maybeSingle();
  return <BookingDetail
    booking={result.data as unknown as Parameters<typeof BookingDetail>[0]["booking"]}
    role="professional"
    profileId={context.profile.id}
    jobId={job?.id}
    exactAddress={result.exactAddress}
    customerContact={result.customerContact as Record<string, unknown> | null}
  />;
}
