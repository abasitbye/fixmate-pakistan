"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

function toMinor(value: FormDataEntryValue | null) {
  return Math.round(Number(value || 0) * 100);
}

export function OfferForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const start = new Date(String(form.get("proposedStartAt"))).toISOString();
    const end = new Date(String(form.get("proposedEndAt"))).toISOString();
    const validUntil = new Date(String(form.get("validUntil"))).toISOString();
    const payload = {
      offerType: form.get("offerType"),
      calloutFeeMinor: toMinor(form.get("calloutFee")),
      laborAmountMinor: toMinor(form.get("laborAmount")),
      materialEstimateMinor: toMinor(form.get("materialEstimate")),
      minimumAmountMinor: form.get("minimumAmount") ? toMinor(form.get("minimumAmount")) : null,
      maximumAmountMinor: form.get("maximumAmount") ? toMinor(form.get("maximumAmount")) : null,
      inspectionFeeMinor: toMinor(form.get("inspectionFee")),
      message: form.get("message"),
      estimatedDurationMinutes: Number(form.get("estimatedDurationMinutes")),
      proposedStartAt: start,
      proposedEndAt: end,
      includesMaterials: form.get("includesMaterials") === "yes",
      warrantyDays: Number(form.get("warrantyDays")),
      validUntil,
      items: [],
    };
    try {
      const draftResponse = await fetch(`/api/v1/professional/requests/${requestId}/offers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const draft = await draftResponse.json() as ApiEnvelope<{ offer: { id: string; version: number } }>;
      if (!draft.success) throw new Error(draft.error.message);
      const submitResponse = await fetch(`/api/v1/professional/offers/${draft.data.offer.id}/submit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `offer-submit:${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ version: draft.data.offer.version }),
      });
      const submitted = await submitResponse.json() as ApiEnvelope<{ offer: unknown }>;
      if (!submitted.success) throw new Error(submitted.error.message);
      router.push("/professional/offers");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The offer could not be submitted.");
    } finally {
      setPending(false);
    }
  }

  return <form className="panel-card form-grid" onSubmit={submit}>
    <label><span>Offer type</span><select className="text-input" name="offerType" defaultValue="fixed_price">
      <option value="fixed_price">Fixed price</option>
      <option value="estimated_range">Estimated range</option>
      <option value="inspection_required">Inspection required</option>
    </select></label>
    <label><span>Labor (PKR)</span><input className="text-input" name="laborAmount" type="number" min="0" step="1" required /></label>
    <label><span>Estimated materials (PKR)</span><input className="text-input" name="materialEstimate" type="number" min="0" step="1" defaultValue="0" required /></label>
    <label><span>Callout fee (PKR)</span><input className="text-input" name="calloutFee" type="number" min="0" step="1" defaultValue="0" required /></label>
    <label><span>Inspection fee (PKR)</span><input className="text-input" name="inspectionFee" type="number" min="0" step="1" defaultValue="0" required /></label>
    <label><span>Minimum range (PKR) <small>Range offers</small></span><input className="text-input" name="minimumAmount" type="number" min="0" step="1" /></label>
    <label><span>Maximum range (PKR) <small>Range offers</small></span><input className="text-input" name="maximumAmount" type="number" min="0" step="1" /></label>
    <label><span>Proposed start</span><input className="text-input" name="proposedStartAt" type="datetime-local" required /></label>
    <label><span>Proposed end</span><input className="text-input" name="proposedEndAt" type="datetime-local" required /></label>
    <label><span>Offer valid until</span><input className="text-input" name="validUntil" type="datetime-local" required /></label>
    <label><span>Estimated duration (minutes)</span><input className="text-input" name="estimatedDurationMinutes" type="number" min="15" max="2880" defaultValue="120" required /></label>
    <label><span>Warranty days</span><input className="text-input" name="warrantyDays" type="number" min="0" max="3650" defaultValue="0" required /></label>
    <label><span>Materials included?</span><select className="text-input" name="includesMaterials" defaultValue="no"><option value="no">No</option><option value="yes">Yes</option></select></label>
    <label className="form-grid__full"><span>Included work, exclusions, and material responsibility</span><textarea className="text-input textarea-input" name="message" minLength={10} maxLength={2000} required /></label>
    {error ? <div className="form-alert form-alert--error form-grid__full" role="alert">{error}</div> : null}
    <div className="form-actions form-grid__full"><button className="button button--primary button--large" disabled={pending}>{pending ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />} {pending ? "Submitting offer…" : "Submit offer"}</button></div>
  </form>;
}
