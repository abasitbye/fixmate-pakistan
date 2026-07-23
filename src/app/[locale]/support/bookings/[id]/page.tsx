import { CalendarClock, ShieldAlert } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { NoShowPanel } from "@/components/support/no-show-panel";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { getBooking } from "@/lib/marketplace/bookings/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function SupportBookingPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: localeValue, id } = await params;
  const locale = localeValue as AppLocale;
  const context = await requireAccount(locale, ["support", "admin", "super_admin"]);
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) redirect(localizedPath(locale, "/support"));
  const result = await getBooking(context, id);
  if (!result.data) notFound();
  const booking = result.data;
  const request = Array.isArray(booking.service_requests) ? booking.service_requests[0] : booking.service_requests;
  const { data: job } = await context.supabase.from("jobs").select("status,actual_arrived_at").eq("booking_id", id).maybeSingle();
  const reviewable = ["confirmed", "rescheduled", "converted_to_job"].includes(booking.status)
    && new Date(booking.scheduled_start_at) <= new Date()
    && !job?.actual_arrived_at
    && (!job || ["confirmed", "en_route"].includes(job.status));
  return <>
    <Link className="dashboard-back" href="/support/bookings">Back to booking reviews</Link>
    <div className="dashboard-heading"><div><span className="section-kicker">{booking.booking_reference}</span><h1>{request?.title ?? "Service booking"}</h1><p>{request?.description}</p></div><span className="status-chip">{booking.status.replaceAll("_", " ")}</span></div>
    <div className="metric-grid">
      <article className="metric-card"><CalendarClock size={20} /><span>Scheduled start</span><strong>{new Date(booking.scheduled_start_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</strong></article>
      <article className="metric-card"><ShieldAlert size={20} /><span>Job state</span><strong>{job?.status?.replaceAll("_", " ") ?? "Not created"}</strong></article>
      <article className="metric-card"><span>Arrival</span><strong>{job?.actual_arrived_at ? "Verified — no-show blocked" : "Not verified"}</strong></article>
    </div>
    {reviewable ? <NoShowPanel bookingId={booking.id} /> : <section className="panel-card"><h2>No-show review unavailable</h2><p>This booking is either before its scheduled start, already has verified arrival, or is in a state where an attendance outcome cannot be recorded.</p></section>}
  </>;
}
