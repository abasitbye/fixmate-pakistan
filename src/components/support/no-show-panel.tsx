"use client";

import { ClipboardCheck, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

export function NoShowPanel({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("Record this reviewed attendance outcome? Both participants will be notified and can contact support to appeal.")) return;
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/bookings/${bookingId}/no-show`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        party: form.get("party"),
        reason: form.get("reason"),
        evidenceReference: form.get("evidenceReference"),
      }),
    });
    const result = await response.json() as ApiEnvelope<{ booking: unknown }>;
    setPending(false);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  return <form className="panel-card form-grid" onSubmit={submit}>
    <h2 className="form-grid__full">Reviewed attendance outcome</h2>
    <p className="form-grid__full">Use only after the scheduled start and a documented support review. No fee, penalty, warning, or refund is applied automatically.</p>
    <label><span>Outcome</span><select className="text-input" name="party" defaultValue="customer">
      <option value="customer">Customer no-show</option>
      <option value="professional">Professional no-show</option>
      <option value="mutual">Mutual inability to attend</option>
      <option value="access_issue">Unable to access property</option>
      <option value="safety">Safety-related non-entry</option>
    </select></label>
    <label><span>Evidence / support case reference</span><input className="text-input" name="evidenceReference" maxLength={500} placeholder="Required for unilateral no-show" /></label>
    <label className="form-grid__full"><span>Detailed review reason</span><textarea className="text-input textarea-input" name="reason" minLength={10} maxLength={2000} required /></label>
    {error ? <div className="form-alert form-alert--error form-grid__full" role="alert">{error}</div> : null}
    <button className="button button--primary form-grid__full" disabled={pending}>{pending ? <LoaderCircle className="spin" size={17} /> : <ClipboardCheck size={17} />} Record reviewed outcome</button>
  </form>;
}
