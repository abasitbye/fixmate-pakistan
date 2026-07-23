"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

export function CompletionForm({ jobId, version }: { jobId: string; version: number }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/jobs/${jobId}/completion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version, summary: form.get("summary"), outstandingNotes: form.get("outstandingNotes") }) });
    const result = await response.json() as ApiEnvelope<{ completion: unknown }>; setPending(false);
    if (!result.success) { setError(result.error.message); return; } router.push(`/professional/jobs/${jobId}`); router.refresh();
  }
  return <form className="panel-card form-grid" onSubmit={submit}><h2 className="form-grid__full">Submit completion</h2><p className="form-grid__full">Final after-work evidence is required. The final price is calculated from the approved quotation and approved change orders.</p><label className="form-grid__full"><span>Work completed</span><textarea className="text-input textarea-input" name="summary" minLength={10} maxLength={5000} required /></label><label className="form-grid__full"><span>Outstanding notes</span><textarea className="text-input textarea-input" name="outstandingNotes" maxLength={3000} /></label>{error ? <div className="form-alert form-alert--error form-grid__full" role="alert">{error}</div> : null}<button className="button button--primary form-grid__full" disabled={pending}>{pending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} Submit for customer review</button></form>;
}
