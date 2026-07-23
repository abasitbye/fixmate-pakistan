"use client";

import { LoaderCircle, Send, XCircle } from "lucide-react";
import { useCallback, useState } from "react";

import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

export function RequestActions({ requestId, version, status }: { requestId: string; version: number; status: string }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [pending, setPending] = useState<"submit" | "cancel" | "">("");
  const [error, setError] = useState("");
  const handleToken = useCallback((value: string) => setToken(value), []);

  async function submit() {
    setPending("submit");
    setError("");
    const response = await fetch(`/api/v1/requests/${requestId}/submit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `request-submit:${crypto.randomUUID()}`,
      },
      body: JSON.stringify({ version, turnstileToken: token }),
    });
    const result = await response.json() as ApiEnvelope<{ request: unknown }>;
    setPending("");
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  async function cancel() {
    const reason = window.prompt("Why are you cancelling this request?")?.trim();
    if (!reason) return;
    setPending("cancel");
    setError("");
    const response = await fetch(`/api/v1/requests/${requestId}/cancel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `request-cancel:${crypto.randomUUID()}`,
      },
      body: JSON.stringify({ version, reason }),
    });
    const result = await response.json() as ApiEnvelope<{ request: unknown }>;
    setPending("");
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  const cancellable = ["draft", "submitted", "matching", "offers_received", "no_match"].includes(status);
  return (
    <section className="panel-card">
      <h2>Request actions</h2>
      {status === "draft" ? <>
        <p>Review the details and complete the security check before submission.</p>
        <TurnstileWidget action="service_request_submit" onToken={handleToken} />
        <div className="inline-actions">
          <button className="button button--primary" onClick={submit} disabled={!token || Boolean(pending)}>
            {pending === "submit" ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} Submit request
          </button>
        </div>
      </> : <p>This request is <strong>{status.replaceAll("_", " ")}</strong>.</p>}
      {cancellable ? <button className="button button--ghost" onClick={cancel} disabled={Boolean(pending)}>
        {pending === "cancel" ? <LoaderCircle className="spin" size={17} /> : <XCircle size={17} />} Cancel request
      </button> : null}
      {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
    </section>
  );
}
