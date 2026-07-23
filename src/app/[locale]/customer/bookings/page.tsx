import { CalendarClock } from "lucide-react";
import { redirect } from "next/navigation";

import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { listBookings } from "@/lib/marketplace/bookings/service";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function CustomerBookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["customer"]);
  if (!await isMarketplaceFeatureEnabled("phase2.jobs_enabled")) redirect(localizedPath(locale, "/customer"));
  const { data } = await listBookings(context);
  const bookings = (data ?? []).filter((booking) => booking.customer_id === context.profile.id);
  return <>
    <div className="dashboard-heading"><div><span className="section-kicker">Scheduling</span><h1>Your bookings</h1><p>Review confirmed terms, schedule proposals, cancellation outcomes, and professional confirmation.</p></div></div>
    <div className="card-list">
      {bookings.map((booking) => {
        const request = Array.isArray(booking.service_requests) ? booking.service_requests[0] : booking.service_requests;
        return <Link className="panel-card setting-row" href={`/customer/bookings/${booking.id}`} key={booking.id}>
          <span className="panel-icon"><CalendarClock size={20} /></span>
          <div><h2>{request?.title ?? "Service booking"}</h2><p>{booking.booking_reference} · {new Date(booking.scheduled_start_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</p></div>
          <span className="status-chip">{booking.status.replaceAll("_", " ")}</span>
        </Link>;
      })}
      {!bookings.length ? <article className="panel-card"><h2>No bookings yet</h2><p>A booking appears after you accept a professional offer.</p><Link className="button button--primary" href="/customer/requests">View service requests</Link></article> : null}
    </div>
  </>;
}
