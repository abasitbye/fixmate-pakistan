"use client";

import { CalendarClock, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";
import { createMoney, formatMoney } from "@/lib/marketplace/money";

type Offer = {
  id: string;
  offer_reference: string;
  offer_type: string;
  currency_code: string;
  total_amount_minor: number | null;
  minimum_amount_minor: number | null;
  maximum_amount_minor: number | null;
  inspection_fee_minor: number;
  message: string | null;
  estimated_duration_minutes: number | null;
  proposed_start_at: string;
  proposed_end_at: string;
  warranty_days: number;
  version: number;
  service_requests: { version: number } | { version: number }[];
  professional_profiles: {
    business_name: string | null;
    years_experience: number | null;
    user_profiles: { display_name: string | null } | { display_name: string | null }[];
  } | {
    business_name: string | null;
    years_experience: number | null;
    user_profiles: { display_name: string | null } | { display_name: string | null }[];
  }[];
};

function one<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function OfferComparison({ requestId, offers }: { requestId: string; offers: Offer[] }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function accept(offer: Offer) {
    if (!window.confirm("Select this professional and create the booking? Review the price, schedule, and scope first.")) return;
    setPending(offer.id);
    setError("");
    const request = one(offer.service_requests);
    const response = await fetch(`/api/v1/requests/${requestId}/offers/${offer.id}/accept`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `offer-accept:${crypto.randomUUID()}`,
      },
      body: JSON.stringify({ version: offer.version, requestVersion: request.version }),
    });
    const result = await response.json() as ApiEnvelope<{ booking: { id: string } }>;
    setPending("");
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    router.push(`/customer/bookings/${result.data.booking.id}`);
    router.refresh();
  }

  return <div className="card-list">
    {offers.map((offer) => {
      const professional = one(offer.professional_profiles);
      const user = one(professional.user_profiles);
      const price = offer.offer_type === "estimated_range"
        ? `${formatMoney(createMoney(offer.minimum_amount_minor ?? 0, offer.currency_code))}–${formatMoney(createMoney(offer.maximum_amount_minor ?? 0, offer.currency_code))}`
        : formatMoney(createMoney(offer.total_amount_minor ?? offer.inspection_fee_minor, offer.currency_code));
      return <article className="panel-card" key={offer.id}>
        <div className="dashboard-heading"><div><span className="section-kicker">{offer.offer_reference}</span><h2>{professional.business_name || user.display_name || "Verified professional"}</h2><p>{professional.years_experience ?? 0} years experience · New to FixMate until completed reviews are available</p></div><strong>{price}</strong></div>
        <div className="status-flow"><span><ShieldCheck size={16} /> {offer.offer_type.replaceAll("_", " ")}</span><span><CalendarClock size={16} /> {new Date(offer.proposed_start_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</span><span>Warranty: {offer.warranty_days} days</span></div>
        <p>{offer.message}</p>
        <button className="button button--primary" onClick={() => accept(offer)} disabled={Boolean(pending)}>{pending === offer.id ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />} Select this offer</button>
      </article>;
    })}
    {offers.length === 0 ? <article className="panel-card"><h2>No active offers yet</h2><p>FixMate is continuing controlled matching. You will be notified when a professional submits an offer.</p></article> : null}
    {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
  </div>;
}
