"use client";

import { CheckCircle2, LoaderCircle, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";
import { createMoney, formatMoney } from "@/lib/marketplace/money";

type Quotation = {
  id: string; quotation_reference: string; version_number: number; currency_code: string; total_minor: number;
  deposit_required_minor: number; estimated_duration_minutes: number | null; warranty_days: number; terms: string | null;
  exclusions: string | null; valid_until: string | null; status: string; version: number;
  job_quotation_items: Array<{ id: string; item_type: string; description: string; quantity: number; unit: string; amount_minor: number; material_source: string | null }>;
};

export function QuotationList({ quotations, role }: { quotations: Quotation[]; role: "customer" | "professional" }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function decide(quotation: Quotation, action: "approve" | "reject" | "request-revision" | "request-clarification") {
    const reason = action === "approve" ? "" : window.prompt("Add a clear reason or question:")?.trim();
    if (action !== "approve" && !reason) return;
    if (action === "approve" && !window.confirm("Approve this exact itemized quotation version and authorize the documented work?")) return;
    setPending(quotation.id); setError("");
    const response = await fetch(`/api/v1/quotations/${quotation.id}/${action}`, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": `quotation-${action}:${crypto.randomUUID()}` },
      body: JSON.stringify({ version: quotation.version, reason }),
    });
    const result = await response.json() as ApiEnvelope<{ quotation: unknown }>;
    setPending("");
    if (!result.success) { setError(result.error.message); return; }
    router.refresh();
  }

  return <div className="card-list">
    {quotations.map((quotation) => <article className="panel-card" key={quotation.id}>
      <div className="dashboard-heading"><div><span className="section-kicker">{quotation.quotation_reference} · Version {quotation.version_number}</span><h2>{formatMoney(createMoney(quotation.total_minor, quotation.currency_code))}</h2><p>Deposit: {formatMoney(createMoney(quotation.deposit_required_minor, quotation.currency_code))} · {quotation.estimated_duration_minutes ?? "—"} minutes · {quotation.warranty_days} day warranty</p></div><span className="status-chip">{quotation.status.replaceAll("_", " ")}</span></div>
      <div className="quotation-summary">{quotation.job_quotation_items.map((item) => <div key={item.id}><span>{item.description}<small>{item.quantity} {item.unit}{item.material_source ? ` · ${item.material_source} supplies` : ""}</small></span><strong>{item.item_type === "discount" ? "−" : ""}{formatMoney(createMoney(item.amount_minor, quotation.currency_code))}</strong></div>)}</div>
      <p><strong>Terms:</strong> {quotation.terms}</p>{quotation.exclusions ? <p><strong>Exclusions:</strong> {quotation.exclusions}</p> : null}
      {role === "customer" && quotation.status === "submitted" ? <div className="inline-actions quotation-decisions">
        <button className="button button--primary" disabled={Boolean(pending)} onClick={() => decide(quotation, "approve")}><CheckCircle2 size={16} /> Approve version</button>
        <button className="button button--ghost" disabled={Boolean(pending)} onClick={() => decide(quotation, "request-revision")}><RotateCcw size={16} /> Request revision</button>
        <button className="button button--ghost" disabled={Boolean(pending)} onClick={() => decide(quotation, "request-clarification")}>Ask question</button>
        <button className="button button--ghost" disabled={Boolean(pending)} onClick={() => decide(quotation, "reject")}><XCircle size={16} /> Reject</button>
      </div> : null}
      {pending === quotation.id ? <p><LoaderCircle className="spin" size={16} /> Saving explicit decision…</p> : null}
    </article>)}
    {!quotations.length ? <article className="panel-card"><h2>No quotations yet</h2><p>The professional can submit an itemized, versioned quotation after verified arrival or inspection.</p></article> : null}
    {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
  </div>;
}
