import { CalendarClock, History, MapPinHouse, ShieldCheck, UserRound } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { createMoney, formatMoney } from "@/lib/marketplace/money";

import { BookingActions } from "./booking-actions";

type Relation<T> = T | T[] | null;
type Booking = {
  id: string;
  booking_reference: string;
  customer_id: string;
  professional_id: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  status: string;
  version: number;
  confirmation_deadline_at: string;
  cancellation_fee_minor: number;
  professional_compensation_minor: number;
  service_requests: Relation<{ request_reference: string; title: string; description: string }>;
  accepted_offer_snapshots: Relation<{ commercial_terms: Record<string, unknown> }>;
  professional_profiles: Relation<{ business_name: string | null; user_profiles: Relation<{ display_name: string | null }> }>;
  customer_profiles: Relation<{ user_profiles: Relation<{ display_name: string | null }> }>;
  booking_reschedule_requests: Array<{
    id: string;
    requested_by: string;
    proposed_start_at: string;
    proposed_end_at: string;
    reason: string;
    status: string;
    response_deadline_at: string;
  }>;
  booking_status_history: Array<{
    id: number;
    to_status: string;
    actor_role: string | null;
    reason: string | null;
    created_at: string;
  }>;
};

function one<T>(value: Relation<T>) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function BookingDetail({
  booking,
  role,
  profileId,
  jobId,
  exactAddress,
  customerContact,
}: {
  booking: Booking;
  role: "customer" | "professional";
  profileId: string;
  jobId?: string | null;
  exactAddress?: Record<string, unknown> | null;
  customerContact?: Record<string, unknown> | null;
}) {
  const request = one(booking.service_requests);
  const snapshot = one(booking.accepted_offer_snapshots);
  const professional = one(booking.professional_profiles);
  const professionalUser = one(professional?.user_profiles ?? null);
  const customer = one(booking.customer_profiles);
  const customerUser = one(customer?.user_profiles ?? null);
  const terms = snapshot?.commercial_terms ?? {};
  const total = Number(terms.totalAmountMinor ?? terms.maximumAmountMinor ?? terms.inspectionFeeMinor ?? 0);
  const participantName = role === "customer"
    ? professional?.business_name || professionalUser?.display_name || "Selected professional"
    : customerUser?.display_name || "Customer";
  const sortedHistory = [...(booking.booking_status_history ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return <>
    <div className="dashboard-heading">
      <div><span className="section-kicker">{booking.booking_reference}</span><h1>{request?.title ?? "Service booking"}</h1><p>{request?.description}</p></div>
      <span className="status-chip">{booking.status.replaceAll("_", " ")}</span>
    </div>
    <div className="metric-grid">
      <article className="metric-card"><CalendarClock size={20} /><span>Scheduled</span><strong>{new Date(booking.scheduled_start_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</strong></article>
      <article className="metric-card"><UserRound size={20} /><span>{role === "customer" ? "Professional" : "Customer"}</span><strong>{participantName}</strong></article>
      <article className="metric-card"><ShieldCheck size={20} /><span>Accepted terms</span><strong>{formatMoney(createMoney(total, String(terms.currencyCode ?? "PKR")))}</strong></article>
    </div>
    <div className="dashboard-grid dashboard-grid--main">
      <div className="card-list">
        <section className="panel-card">
          <h2>Schedule and commercial snapshot</h2>
          <p><strong>Start:</strong> {new Date(booking.scheduled_start_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</p>
          <p><strong>End:</strong> {new Date(booking.scheduled_end_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</p>
          <p><strong>Offer type:</strong> {String(terms.offerType ?? "agreed").replaceAll("_", " ")}</p>
          <p><strong>Warranty:</strong> {String(terms.warrantyDays ?? 0)} days</p>
          <p>{String(terms.message ?? "")}</p>
          {booking.status === "pending_confirmation" ? <small>Professional confirmation is due {new Date(booking.confirmation_deadline_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}.</small> : null}
        </section>
        {role === "professional" ? <section className="panel-card">
          <h2><MapPinHouse size={18} /> Private service address</h2>
          {exactAddress ? <>
            <p><strong>{String(exactAddress.label ?? "Service property")}</strong></p>
            <p>{String(exactAddress.addressLine1 ?? "")}{exactAddress.addressLine2 ? `, ${String(exactAddress.addressLine2)}` : ""}</p>
            {exactAddress.accessNotes ? <p><strong>Access notes:</strong> {String(exactAddress.accessNotes)}</p> : null}
            {customerContact?.phone ? <p><strong>Booking contact:</strong> {String(customerContact.phone)}</p> : null}
          </> : <p>The exact address and booking contact are released only after professional confirmation.</p>}
        </section> : null}
        <section className="panel-card">
          <h2><History size={18} /> Booking history</h2>
          <div className="timeline-list">
            {sortedHistory.map((entry) => <div key={entry.id}><span className="timeline-dot" /><div><strong>{entry.to_status.replaceAll("_", " ")}</strong><p>{entry.actor_role ?? "system"} · {new Date(entry.created_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</p>{entry.reason ? <small>{entry.reason}</small> : null}</div></div>)}
          </div>
        </section>
        {booking.cancellation_fee_minor > 0 ? <section className="panel-card"><h2>Recorded cancellation outcome</h2><p>Fee: {formatMoney(createMoney(booking.cancellation_fee_minor, "PKR"))}</p><p>Professional compensation: {formatMoney(createMoney(booking.professional_compensation_minor, "PKR"))}</p></section> : null}
      </div>
      <div>
        <BookingActions
          bookingId={booking.id}
          profileId={profileId}
          role={role}
          status={booking.status}
          version={booking.version}
          jobId={jobId}
          reschedules={booking.booking_reschedule_requests ?? []}
        />
        <Link className="dashboard-back" href={`/${role}/bookings`}>Back to bookings</Link>
      </div>
    </div>
  </>;
}
