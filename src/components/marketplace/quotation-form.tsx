"use client";

import { LoaderCircle, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";
import { createMoney, formatMoney } from "@/lib/marketplace/money";

type DraftItem = { itemType: "labor" | "material" | "other" | "discount"; description: string; quantity: number; unit: string; unitPrice: number; materialSource: "professional" | "customer" | "mixed" };

const blankItem = (): DraftItem => ({ itemType: "labor", description: "", quantity: 1, unit: "job", unitPrice: 0, materialSource: "professional" });

export function QuotationForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<DraftItem[]>([blankItem()]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const totalMinor = items.reduce((sum, item) => sum + (item.itemType === "discount" ? -1 : 1) * Math.round(item.quantity * item.unitPrice * 100), 0);

  function update(index: number, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      version: 0,
      depositRequiredMinor: Math.round(Number(form.get("deposit") || 0) * 100),
      estimatedDurationMinutes: Number(form.get("duration")),
      warrantyDays: Number(form.get("warrantyDays")),
      terms: form.get("terms"),
      exclusions: form.get("exclusions"),
      notes: form.get("notes"),
      validUntil: new Date(String(form.get("validUntil"))).toISOString(),
      items: items.map((item) => ({
        itemType: item.itemType, description: item.description, quantity: item.quantity,
        unit: item.unit, unitPriceMinor: Math.round(item.unitPrice * 100),
        materialSource: item.itemType === "material" ? item.materialSource : undefined,
      })),
    };
    try {
      const draftResponse = await fetch(`/api/v1/jobs/${jobId}/quotations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const draft = await draftResponse.json() as ApiEnvelope<{ quotation: { id: string; version: number } }>;
      if (!draft.success) throw new Error(draft.error.message);
      const submitResponse = await fetch(`/api/v1/quotations/${draft.data.quotation.id}/submit`, {
        method: "POST", headers: { "content-type": "application/json", "idempotency-key": `quotation-submit:${crypto.randomUUID()}` },
        body: JSON.stringify({ version: draft.data.quotation.version }),
      });
      const submitted = await submitResponse.json() as ApiEnvelope<{ quotation: unknown }>;
      if (!submitted.success) throw new Error(submitted.error.message);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The quotation could not be submitted.");
    } finally { setPending(false); }
  }

  return <form className="panel-card form-grid" onSubmit={submit}>
    <div className="form-grid__full dashboard-heading"><div><h2>New quotation version</h2><p>Submitted versions are immutable. Customer approval is required before paid work starts.</p></div><strong>{formatMoney(createMoney(Math.max(0, totalMinor), "PKR"))}</strong></div>
    <div className="form-grid__full quotation-items">
      {items.map((item, index) => <div className="quotation-item" key={index}>
        <select className="text-input" value={item.itemType} onChange={(event) => update(index, { itemType: event.target.value as DraftItem["itemType"] })}><option value="labor">Labor</option><option value="material">Material</option><option value="other">Other</option><option value="discount">Discount</option></select>
        <input className="text-input" aria-label={`Item ${index + 1} description`} placeholder="Description" value={item.description} onChange={(event) => update(index, { description: event.target.value })} required />
        <input className="text-input" aria-label={`Item ${index + 1} quantity`} type="number" min=".001" step=".001" value={item.quantity} onChange={(event) => update(index, { quantity: Number(event.target.value) })} required />
        <input className="text-input" aria-label={`Item ${index + 1} unit`} placeholder="Unit" value={item.unit} onChange={(event) => update(index, { unit: event.target.value })} required />
        <input className="text-input" aria-label={`Item ${index + 1} unit price`} type="number" min="0" step=".01" placeholder="PKR/unit" value={item.unitPrice} onChange={(event) => update(index, { unitPrice: Number(event.target.value) })} required />
        {item.itemType === "material" ? <select className="text-input" aria-label="Material responsibility" value={item.materialSource} onChange={(event) => update(index, { materialSource: event.target.value as DraftItem["materialSource"] })}><option value="professional">Professional supplies</option><option value="customer">Customer supplies</option><option value="mixed">Mixed</option></select> : null}
        <button className="icon-button" type="button" aria-label="Remove item" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={items.length === 1}><Trash2 size={16} /></button>
      </div>)}
      <button className="button button--ghost" type="button" onClick={() => setItems((current) => [...current, blankItem()])}><Plus size={16} /> Add line item</button>
    </div>
    <label><span>Estimated duration (minutes)</span><input className="text-input" name="duration" type="number" min="15" max="43200" defaultValue="120" required /></label>
    <label><span>Warranty days</span><input className="text-input" name="warrantyDays" type="number" min="0" max="3650" defaultValue="30" required /></label>
    <label><span>Deposit required (PKR)</span><input className="text-input" name="deposit" type="number" min="0" step=".01" defaultValue="0" required /></label>
    <label><span>Valid until</span><input className="text-input" name="validUntil" type="datetime-local" required /></label>
    <label className="form-grid__full"><span>Terms</span><textarea className="text-input textarea-input" name="terms" minLength={10} maxLength={5000} required /></label>
    <label className="form-grid__full"><span>Exclusions</span><textarea className="text-input textarea-input" name="exclusions" maxLength={3000} /></label>
    <label className="form-grid__full"><span>Notes</span><textarea className="text-input textarea-input" name="notes" maxLength={3000} /></label>
    {error ? <div className="form-alert form-alert--error form-grid__full" role="alert">{error}</div> : null}
    <button className="button button--primary form-grid__full" disabled={pending || totalMinor <= 0}>{pending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} Submit immutable quotation version</button>
  </form>;
}
