"use client";

import { ClipboardCheck, FileText, LoaderCircle, MessageCircle, Pause, Play, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

export function ExecutionActions({ jobId, role, status, version }: { jobId: string; role: "customer" | "professional"; status: string; version: number }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function command(path: string, body: unknown, action: string, idempotent = false) {
    setPending(action); setError("");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (idempotent) headers["idempotency-key"] = `${action}:${crypto.randomUUID()}`;
    const response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
    const result = await response.json() as ApiEnvelope<Record<string, unknown>>;
    setPending("");
    if (!result.success) { setError(result.error.message); return; }
    router.refresh();
  }

  async function pause() {
    const reason = window.prompt("Pause reason: waiting for material, customer unavailable, safety issue, approval, weather, access, or another documented reason.")?.trim();
    if (reason) await command(`/api/v1/jobs/${jobId}/work/pause`, { version, reason }, "pause");
  }

  async function completionDecision(decision: "confirm" | "report-issue") {
    const notes = decision === "report-issue"
      ? window.prompt("Describe the incomplete work or damage in detail.")?.trim()
      : window.prompt("Optional completion notes:")?.trim() ?? "";
    if (decision === "report-issue" && !notes) return;
    if (!window.confirm(decision === "confirm" ? "Confirm that the documented work is complete?" : "Report this completion issue to the professional?")) return;
    await command(`/api/v1/jobs/${jobId}/completion/${decision}`, { notes }, `completion-${decision}`, true);
  }

  return <section className="panel-card">
    <h2>Execution controls</h2>
    <div className="stacked-actions">
      <Link className="button button--ghost" href={`/${role}/jobs/${jobId}/chat`}><MessageCircle size={17} /> Job chat</Link>
      <Link className="button button--ghost" href={`/${role}/jobs/${jobId}/quotation`}><FileText size={17} /> Quotations</Link>
      {role === "professional" && ["arrived", "inspecting"].includes(status) ? <Link className="button button--primary" href={`/professional/jobs/${jobId}/inspection`}><ClipboardCheck size={17} /> Inspection</Link> : null}
      {role === "professional" && ["arrived", "awaiting_quotation"].includes(status) ? <Link className="button button--primary" href={`/professional/jobs/${jobId}/quotation`}><FileText size={17} /> Prepare quotation</Link> : null}
      {role === "professional" && ["approved", "in_progress", "paused"].includes(status) ? <Link className="button button--ghost" href={`/professional/jobs/${jobId}/change-orders`}>Change orders</Link> : null}
      {role === "professional" && status === "approved" ? <button className="button button--primary" onClick={() => command(`/api/v1/jobs/${jobId}/work/start`, { version }, "start-work")} disabled={Boolean(pending)}><Play size={17} /> Start approved work</button> : null}
      {role === "professional" && status === "in_progress" ? <>
        <button className="button button--ghost" onClick={pause} disabled={Boolean(pending)}><Pause size={17} /> Pause work</button>
        <Link className="button button--primary" href={`/professional/jobs/${jobId}/completion`}><ClipboardCheck size={17} /> Submit completion</Link>
      </> : null}
      {role === "professional" && status === "paused" ? <button className="button button--primary" onClick={() => command(`/api/v1/jobs/${jobId}/work/resume`, { version }, "resume-work")} disabled={Boolean(pending)}><RotateCcw size={17} /> Resume work</button> : null}
      {role === "customer" && status === "completion_submitted" ? <>
        <button className="button button--primary" onClick={() => completionDecision("confirm")} disabled={Boolean(pending)}>Confirm completion</button>
        <button className="button button--ghost" onClick={() => completionDecision("report-issue")} disabled={Boolean(pending)}>Report incomplete work or damage</button>
      </> : null}
    </div>
    {pending ? <p><LoaderCircle className="spin" size={16} /> Saving the job update…</p> : null}
    {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
  </section>;
}
