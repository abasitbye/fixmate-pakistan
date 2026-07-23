import { CalendarClock } from "lucide-react";
import { redirect } from "next/navigation";

import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { listStaffBookings } from "@/lib/marketplace/bookings/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function SupportBookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["support", "admin", "super_admin"]);
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) redirect(localizedPath(locale, "/support"));
  const { data } = await listStaffBookings(context);
  return <>
    <div className="dashboard-heading"><div><span className="section-kicker">Booking operations</span><h1>Booking reviews</h1><p>Review attendance and access outcomes without applying undocumented automatic penalties.</p></div></div>
    <div className="card-list">
      {(data ?? []).map((booking) => {
        const request = Array.isArray(booking.service_requests) ? booking.service_requests[0] : booking.service_requests;
        return <Link className="panel-card setting-row" href={`/support/bookings/${booking.id}`} key={booking.id}><span className="panel-icon"><CalendarClock size={20} /></span><div><h2>{request?.title ?? "Service booking"}</h2><p>{booking.booking_reference} · {new Date(booking.scheduled_start_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</p></div><span className="status-chip">{booking.status.replaceAll("_", " ")}</span></Link>;
      })}
      {!data?.length ? <article className="panel-card"><h2>No bookings to review</h2><p>Marketplace booking records will appear here after launch.</p></article> : null}
    </div>
  </>;
}
