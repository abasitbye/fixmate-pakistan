"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

type ReviewKind = "alert" | "risk";

const outcomes = {
  alert: ["acknowledged", "resolved"],
  risk: ["reviewing", "dismissed", "confirmed", "appealed", "closed"],
} as const;

export function OperationsReviewForm({
  id,
  kind,
}: {
  id: string;
  kind: ReviewKind;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status") ?? "");
    const note = String(form.get("note") ?? "");

    startTransition(async () => {
      const response = await fetch(
        `/api/v1/support/operations/${kind === "alert" ? "alerts" : "risks"}/${id}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status, note }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(payload?.error?.message ?? "The review could not be saved.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <details className="operations-review">
      <summary>Record staff review</summary>
      <form className="form-grid" onSubmit={submit}>
        <label>
          <span>Outcome</span>
          <select className="text-input" name="status" required>
            {outcomes[kind].map((outcome) => (
              <option key={outcome} value={outcome}>
                {outcome.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="form-grid__full">
          <span>Evidence-based note</span>
          <textarea
            className="text-input"
            name="note"
            minLength={kind === "risk" ? 10 : 5}
            maxLength={2000}
            required
          />
        </label>
        <button className="button button--primary" disabled={pending}>
          {pending ? "Saving…" : "Save review"}
        </button>
        {error ? (
          <p className="form-alert form-alert--error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </details>
  );
}
