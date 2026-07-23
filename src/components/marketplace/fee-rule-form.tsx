"use client";

import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

export function FeeRuleForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    const response = await fetch("/api/v1/admin/fees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name")),
        feeType: String(formData.get("feeType")),
        percentageBasisPoints: Number(
          formData.get("percentageBasisPoints") || 0,
        ),
        fixedAmountMinor: Math.round(
          Number(formData.get("fixedAmountPkr") || 0) * 100,
        ),
        minimumFeeMinor: formData.get("minimumFeePkr")
          ? Math.round(Number(formData.get("minimumFeePkr")) * 100)
          : null,
        maximumFeeMinor: formData.get("maximumFeePkr")
          ? Math.round(Number(formData.get("maximumFeePkr")) * 100)
          : null,
        effectiveFrom: new Date(
          String(formData.get("effectiveFrom")),
        ).toISOString(),
        effectiveUntil: null,
        isActive: true,
      }),
    });
    const result = (await response.json()) as ApiEnvelope<
      Record<string, unknown>
    >;
    setPending(false);
    if (!result.success) setError(result.error.message);
    else router.refresh();
  }
  return (
    <form className="panel-card form-stack" action={submit}>
      <h2>Create effective-dated commission rule</h2>
      <p>
        Specific category/city rules can be added through the API. No fee or tax
        rate is hardcoded.
      </p>
      <label className="field-label">
        Rule name
        <input className="text-input" name="name" required minLength={3} />
      </label>
      <label className="field-label">
        Fee type
        <select className="text-input" name="feeType">
          <option value="percentage">Percentage</option>
          <option value="fixed">Fixed</option>
          <option value="percentage_plus_fixed">Percentage plus fixed</option>
        </select>
      </label>
      <label className="field-label">
        Percentage (basis points)
        <input
          className="text-input"
          name="percentageBasisPoints"
          type="number"
          min="0"
          max="10000"
          defaultValue="0"
        />
      </label>
      <label className="field-label">
        Fixed amount (PKR)
        <input
          className="text-input"
          name="fixedAmountPkr"
          type="number"
          min="0"
          step="0.01"
          defaultValue="0"
        />
      </label>
      <label className="field-label">
        Minimum fee (PKR, optional)
        <input
          className="text-input"
          name="minimumFeePkr"
          type="number"
          min="0"
          step="0.01"
        />
      </label>
      <label className="field-label">
        Maximum fee (PKR, optional)
        <input
          className="text-input"
          name="maximumFeePkr"
          type="number"
          min="0"
          step="0.01"
        />
      </label>
      <label className="field-label">
        Effective from
        <input
          className="text-input"
          name="effectiveFrom"
          type="datetime-local"
          required
        />
      </label>
      <button className="button button--primary" disabled={pending}>
        {pending ? "Saving…" : "Create fee rule"}
      </button>
      {error ? (
        <div className="form-alert form-alert--error">{error}</div>
      ) : null}
    </form>
  );
}
