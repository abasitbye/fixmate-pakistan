"use client";

import { LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

async function post(path: string, body: unknown, idempotent = false) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (idempotent) headers["idempotency-key"] = `finance:${crypto.randomUUID()}`;
  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return response.json() as Promise<ApiEnvelope<Record<string, unknown>>>;
}

export function ReconciliationActions({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function decide(confirmed: boolean) {
    const resolution = window
      .prompt("Document the evidence reviewed and decision:")
      ?.trim();
    const evidenceReference =
      window.prompt("Optional evidence or support reference:")?.trim() ?? "";
    if (!resolution) return;
    setPending(true);
    const result = await post(`/api/v1/admin/reconciliation/${caseId}`, {
      confirmed,
      resolution,
      evidenceReference,
    });
    setPending(false);
    if (!result.success) setError(result.error.message);
    else router.refresh();
  }
  return (
    <div className="stacked-actions">
      <button
        className="button button--primary"
        onClick={() => decide(true)}
        disabled={pending}
      >
        Confirm payment
      </button>
      <button
        className="button button--ghost"
        onClick={() => decide(false)}
        disabled={pending}
      >
        Reject report
      </button>
      {pending ? <LoaderCircle className="spin" size={16} /> : null}
      {error ? (
        <span className="form-alert form-alert--error">{error}</span>
      ) : null}
    </div>
  );
}

export function RefundActions({
  refundId,
  status,
}: {
  refundId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function decide(approved: boolean) {
    const reason = window.prompt("Document the refund decision:")?.trim();
    if (!reason) return;
    setPending(true);
    const result = await post(`/api/v1/admin/refunds/${refundId}/decide`, {
      approved,
      reason,
    });
    setPending(false);
    if (!result.success) setError(result.error.message);
    else router.refresh();
  }
  async function complete() {
    const providerReference = window
      .prompt("Enter the verified manual refund/transfer reference:")
      ?.trim();
    if (!providerReference) return;
    setPending(true);
    const result = await post(`/api/v1/admin/refunds/${refundId}/complete`, {
      providerReference,
    });
    setPending(false);
    if (!result.success) setError(result.error.message);
    else router.refresh();
  }
  return (
    <div className="stacked-actions">
      {status === "requested" ? (
        <>
          <button
            className="button button--primary"
            onClick={() => decide(true)}
            disabled={pending}
          >
            Approve
          </button>
          <button
            className="button button--ghost"
            onClick={() => decide(false)}
            disabled={pending}
          >
            Reject
          </button>
        </>
      ) : null}
      {status === "approved" ? (
        <button
          className="button button--primary"
          onClick={complete}
          disabled={pending}
        >
          Record settled refund
        </button>
      ) : null}
      {error ? (
        <span className="form-alert form-alert--error">{error}</span>
      ) : null}
    </div>
  );
}

export function CreatePayoutButton({
  professionalId,
  earningId,
}: {
  professionalId: string;
  earningId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    if (
      !window.confirm(
        "Create a draft payout for this available earning? A different administrator must approve it.",
      )
    )
      return;
    setPending(true);
    const result = await post(
      "/api/v1/admin/payouts",
      { professionalId, earningIds: [earningId] },
      true,
    );
    setPending(false);
    if (!result.success) setError(result.error.message);
    else router.refresh();
  }
  return (
    <div>
      <button
        className="button button--primary"
        onClick={create}
        disabled={pending}
      >
        {pending ? "Creating…" : "Create draft payout"}
      </button>
      {error ? (
        <div className="form-alert form-alert--error">{error}</div>
      ) : null}
    </div>
  );
}

export function PayoutActions({
  payoutId,
  status,
}: {
  payoutId: string;
  status: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function approve() {
    setPending(true);
    const result = await post(`/api/v1/admin/payouts/${payoutId}/approve`, {});
    setPending(false);
    if (!result.success) setError(result.error.message);
    else router.refresh();
  }
  async function recordPaid() {
    const file = fileRef.current?.files?.[0];
    const providerReference = window
      .prompt("Enter the verified bank, Raast, or wallet transfer reference:")
      ?.trim();
    if (!file || !providerReference) {
      setError("Choose payout evidence and add the transfer reference.");
      return;
    }
    setPending(true);
    setError("");
    const prepared = await post(
      `/api/v1/admin/payouts/${payoutId}/evidence-upload-url`,
      { fileName: file.name, mimeType: file.type },
    );
    if (!prepared.success) {
      setPending(false);
      setError(prepared.error.message);
      return;
    }
    const signedUrl = String(prepared.data.signedUrl);
    const path = String(prepared.data.path);
    const upload = await fetch(signedUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!upload.ok) {
      setPending(false);
      setError("Payout evidence upload failed.");
      return;
    }
    const result = await post(`/api/v1/admin/payouts/${payoutId}/record-paid`, {
      providerReference,
      evidenceStoragePath: path,
    });
    setPending(false);
    if (!result.success) setError(result.error.message);
    else router.refresh();
  }
  return (
    <div className="stacked-actions">
      {status === "draft" ? (
        <button
          className="button button--primary"
          onClick={approve}
          disabled={pending}
        >
          Approve (checker)
        </button>
      ) : null}
      {["scheduled", "processing"].includes(status) ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
          />
          <button
            className="button button--primary"
            onClick={recordPaid}
            disabled={pending}
          >
            Upload evidence and record paid
          </button>
        </>
      ) : null}
      {error ? (
        <span className="form-alert form-alert--error">{error}</span>
      ) : null}
    </div>
  );
}
