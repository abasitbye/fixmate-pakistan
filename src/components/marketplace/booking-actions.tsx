"use client";

import { CalendarClock, CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";
import { createMoney, formatMoney } from "@/lib/marketplace/money";

type Reschedule = {
  id: string;
  requested_by: string;
  proposed_start_at: string;
  proposed_end_at: string;
  reason: string;
  status: string;
  response_deadline_at: string;
};

type Props = {
  bookingId: string;
  profileId: string;
  role: "customer" | "professional";
  status: string;
  version: number;
  jobId?: string | null;
  reschedules: Reschedule[];
};

export function BookingActions({
  bookingId,
  profileId,
  role,
  status,
  version,
  jobId,
  reschedules,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const activeReschedule = reschedules.find((item) => item.status === "pending");
  const manageable = ["pending_confirmation", "confirmed", "rescheduled", "converted_to_job"].includes(status);

  async function command(path: string, body: unknown, action: string, idempotent = false) {
    setPending(action);
    setError("");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (idempotent) headers["idempotency-key"] = `${action}:${crypto.randomUUID()}`;
    const response = await fetch(path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const result = await response.json() as ApiEnvelope<Record<string, unknown>>;
    setPending("");
    if (!result.success) {
      setError(result.error.message);
      return false;
    }
    router.refresh();
    return true;
  }

  async function confirm() {
    const success = await command(`/api/v1/bookings/${bookingId}/confirm`, { version }, "booking-confirm", true);
    if (success) router.push("/professional/jobs");
  }

  async function reschedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startValue = String(form.get("proposedStartAt"));
    const endValue = String(form.get("proposedEndAt"));
    await command(`/api/v1/bookings/${bookingId}/reschedule`, {
      version,
      proposedStartAt: new Date(startValue).toISOString(),
      proposedEndAt: new Date(endValue).toISOString(),
      reason: form.get("reason"),
    }, "reschedule");
  }

  async function cancel() {
    setPending("cancellation-preview");
    setError("");
    const response = await fetch(`/api/v1/bookings/${bookingId}/cancel`);
    const preview = await response.json() as ApiEnvelope<{
      cancellation: {
        feeMinor: number;
        professionalCompensationMinor: number;
        policyName: string | null;
        requiresAcknowledgement: boolean;
      };
    }>;
    setPending("");
    if (!preview.success) {
      setError(preview.error.message);
      return;
    }
    const reason = window.prompt("Explain why you need to cancel this booking.")?.trim();
    if (!reason) return;
    const outcome = preview.data.cancellation;
    const disclosure = outcome.requiresAcknowledgement
      ? `The effective policy “${outcome.policyName ?? "Cancellation policy"}” applies a fee of ${formatMoney(createMoney(outcome.feeMinor, "PKR"))}. Continue and acknowledge this fee?`
      : "No cancellation fee is permitted by the currently effective policies. Continue with cancellation?";
    if (!window.confirm(disclosure)) return;
    await command(`/api/v1/bookings/${bookingId}/cancel`, {
      version,
      reason,
      policyAcknowledged: outcome.requiresAcknowledgement,
    }, "cancel");
  }

  return <section className="panel-card">
    <h2>Booking actions</h2>
    {role === "professional" && status === "pending_confirmation" ? <>
      <p>Confirm the agreed schedule to create the job and release the private service address for this booking only.</p>
      <button className="button button--primary" onClick={confirm} disabled={Boolean(pending)}>
        {pending === "booking-confirm" ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={17} />} Confirm booking
      </button>
    </> : null}

    {activeReschedule ? <div className="action-block">
      <h3>Pending schedule proposal</h3>
      <p>{new Date(activeReschedule.proposed_start_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })} — {activeReschedule.reason}</p>
      <small>Response due {new Date(activeReschedule.response_deadline_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</small>
      {activeReschedule.requested_by !== profileId ? <div className="inline-actions">
        <button className="button button--primary" disabled={Boolean(pending)} onClick={() => command(`/api/v1/bookings/${bookingId}/reschedule/${activeReschedule.id}/respond`, { accept: true }, "accept-reschedule")}>Accept</button>
        <button className="button button--ghost" disabled={Boolean(pending)} onClick={() => command(`/api/v1/bookings/${bookingId}/reschedule/${activeReschedule.id}/respond`, { accept: false }, "decline-reschedule")}>Decline</button>
      </div> : <p>Waiting for the other participant to respond.</p>}
    </div> : manageable ? <details className="action-block">
      <summary><CalendarClock size={17} /> Request a different time</summary>
      <form className="form-grid compact-form" onSubmit={reschedule}>
        <label><span>Proposed start</span><input className="text-input" name="proposedStartAt" type="datetime-local" required /></label>
        <label><span>Proposed end</span><input className="text-input" name="proposedEndAt" type="datetime-local" required /></label>
        <label className="form-grid__full"><span>Reason</span><textarea className="text-input textarea-input" name="reason" minLength={3} maxLength={1000} required /></label>
        <button className="button button--primary form-grid__full" disabled={Boolean(pending)}>Send proposal</button>
      </form>
    </details> : null}

    {jobId ? <Link className="button button--primary" href={`/${role}/jobs/${jobId}`}>Open active job</Link> : null}
    {manageable ? <button className="button button--ghost danger-action" onClick={cancel} disabled={Boolean(pending)}>
      {pending.includes("cancel") ? <LoaderCircle className="spin" size={17} /> : <XCircle size={17} />} Cancel booking
    </button> : null}
    {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
  </section>;
}
