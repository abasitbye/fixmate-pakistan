"use client";

import { LoaderCircle, SearchCheck } from "lucide-react";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

type Inspection = { id: string; status: string; version: number; findings: string | null; recommended_work: string | null; safety_notes: string | null };

export function InspectionPanel({ jobId, jobStatus, jobVersion, inspection }: { jobId: string; jobStatus: string; jobVersion: number; inspection: Inspection | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function post(path: string, body: unknown) {
    setPending(true); setError("");
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as ApiEnvelope<Record<string, unknown>>;
    setPending(false);
    if (!result.success) { setError(result.error.message); return; }
    router.refresh();
  }

  async function complete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await post(`/api/v1/jobs/${jobId}/inspection/complete`, {
      inspectionId: inspection?.id, version: inspection?.version,
      findings: form.get("findings"), recommendedWork: form.get("recommendedWork"), safetyNotes: form.get("safetyNotes"),
    });
  }

  return <section className="panel-card">
    <h2>On-site inspection</h2>
    {jobStatus === "arrived" && !inspection ? <><p>Start only after verified arrival. Record findings, recommended work, safety concerns, and supporting evidence.</p><button className="button button--primary" disabled={pending} onClick={() => post(`/api/v1/jobs/${jobId}/inspection/start`, { version: jobVersion })}><SearchCheck size={17} /> Start inspection</button></> : null}
    {inspection?.status === "in_progress" ? <form className="form-grid" onSubmit={complete}>
      <label className="form-grid__full"><span>Findings</span><textarea className="text-input textarea-input" name="findings" minLength={10} maxLength={5000} required /></label>
      <label className="form-grid__full"><span>Recommended work</span><textarea className="text-input textarea-input" name="recommendedWork" minLength={10} maxLength={5000} required /></label>
      <label className="form-grid__full"><span>Safety notes</span><textarea className="text-input textarea-input" name="safetyNotes" maxLength={3000} /></label>
      <button className="button button--primary form-grid__full" disabled={pending}>Complete inspection</button>
    </form> : null}
    {inspection?.status === "completed" ? <><p><strong>Findings:</strong> {inspection.findings}</p><p><strong>Recommended work:</strong> {inspection.recommended_work}</p>{inspection.safety_notes ? <p><strong>Safety:</strong> {inspection.safety_notes}</p> : null}</> : null}
    {pending ? <p><LoaderCircle className="spin" size={16} /> Saving…</p> : null}
    {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
  </section>;
}
