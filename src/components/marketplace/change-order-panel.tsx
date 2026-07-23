"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";
import { createMoney, formatMoney } from "@/lib/marketplace/money";

type ChangeOrder = { id: string; change_order_reference: string; reason: string; description: string; total_change_minor: number; schedule_change_minutes: number; status: string; version: number; emergency_safety_exception: boolean };

export function ChangeOrderPanel({ jobId, role, changeOrders }: { jobId: string; role: "customer" | "professional"; changeOrders: ChangeOrder[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      version: 0, reason: form.get("reason"), description: form.get("description"), evidenceSummary: form.get("evidenceSummary"),
      laborChangeMinor: Math.round(Number(form.get("labor") || 0) * 100),
      materialChangeMinor: Math.round(Number(form.get("materials") || 0) * 100),
      otherChangeMinor: Math.round(Number(form.get("other") || 0) * 100),
      scheduleChangeMinutes: Number(form.get("scheduleChangeMinutes") || 0),
      emergencySafetyException: false, emergencyJustification: "",
    };
    try {
      const draftResponse = await fetch(`/api/v1/jobs/${jobId}/change-orders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const draft = await draftResponse.json() as ApiEnvelope<{ changeOrder: { id: string; version: number } }>;
      if (!draft.success) throw new Error(draft.error.message);
      const submitResponse = await fetch(`/api/v1/change-orders/${draft.data.changeOrder.id}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: draft.data.changeOrder.version }) });
      const submitted = await submitResponse.json() as ApiEnvelope<{ changeOrder: unknown }>;
      if (!submitted.success) throw new Error(submitted.error.message);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The change order could not be submitted."); }
    finally { setPending(false); }
  }

  async function decide(id: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("Why are you rejecting this change order?")?.trim() : "";
    if (action === "reject" && !reason) return;
    if (action === "approve" && !window.confirm("Approve this exact scope and price change before the additional work proceeds?")) return;
    setPending(true); setError("");
    const response = await fetch(`/api/v1/change-orders/${id}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
    const result = await response.json() as ApiEnvelope<{ changeOrder: unknown }>;
    setPending(false);
    if (!result.success) setError(result.error.message); else router.refresh();
  }

  return <div className="card-list">
    {changeOrders.map((change) => <article className="panel-card" key={change.id}>
      <div className="dashboard-heading"><div><span className="section-kicker">{change.change_order_reference}</span><h2>{formatMoney(createMoney(change.total_change_minor, "PKR"))}</h2><p>{change.reason}</p></div><span className="status-chip">{change.status}</span></div>
      <p>{change.description}</p><p>Schedule effect: {change.schedule_change_minutes} minutes</p>
      {change.emergency_safety_exception ? <div className="form-alert">Emergency safety exception documented</div> : null}
      {role === "customer" && change.status === "submitted" ? <div className="inline-actions"><button className="button button--primary" onClick={() => decide(change.id, "approve")} disabled={pending}>Approve</button><button className="button button--ghost" onClick={() => decide(change.id, "reject")} disabled={pending}>Reject</button></div> : null}
    </article>)}
    {role === "professional" ? <form className="panel-card form-grid" onSubmit={create}>
      <h2 className="form-grid__full">Submit a change order</h2><p className="form-grid__full">Document hidden damage or changed scope. Non-emergency affected work pauses until explicit approval.</p>
      <label><span>Labor change (PKR)</span><input className="text-input" name="labor" type="number" step=".01" defaultValue="0" /></label>
      <label><span>Material change (PKR)</span><input className="text-input" name="materials" type="number" step=".01" defaultValue="0" /></label>
      <label><span>Other change (PKR)</span><input className="text-input" name="other" type="number" step=".01" defaultValue="0" /></label>
      <label><span>Schedule change (minutes)</span><input className="text-input" name="scheduleChangeMinutes" type="number" defaultValue="0" /></label>
      <label className="form-grid__full"><span>Reason</span><input className="text-input" name="reason" minLength={3} maxLength={1000} required /></label>
      <label className="form-grid__full"><span>Added or removed work</span><textarea className="text-input textarea-input" name="description" minLength={3} maxLength={4000} required /></label>
      <label className="form-grid__full"><span>Evidence summary</span><textarea className="text-input textarea-input" name="evidenceSummary" maxLength={2000} /></label>
      <button className="button button--primary form-grid__full" disabled={pending}>{pending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} Submit for approval</button>
    </form> : null}
    {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
  </div>;
}
