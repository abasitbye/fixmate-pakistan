"use client";

import { ArrowRight, BriefcaseBusiness, House, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

export function PurposeForm() {
  const router = useRouter();
  const [purpose, setPurpose] = useState<"customer" | "professional" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!purpose) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/me/purpose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose }),
      });
      const result = (await response.json()) as ApiEnvelope<{ next: string }>;
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      router.replace(result.data.next);
      router.refresh();
    } catch {
      setError("Your selection could not be saved. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="auth-card__heading">
        <span className="auth-step">Step 2 of 2</span>
        <h2>How will you use FixMate?</h2>
        <p>You will always retain customer access. Professionals complete a separate verification application.</p>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <div className="purpose-grid" role="radiogroup" aria-label="Account purpose">
          <label className={`purpose-card ${purpose === "customer" ? "is-selected" : ""}`}>
            <input className="sr-only" type="radio" name="purpose" value="customer" onChange={() => setPurpose("customer")} />
            <span className="purpose-card__icon"><House size={24} /></span><strong>I need a service</strong><small>Manage your profile and saved properties.</small>
          </label>
          <label className={`purpose-card ${purpose === "professional" ? "is-selected" : ""}`}>
            <input className="sr-only" type="radio" name="purpose" value="professional" onChange={() => setPurpose("professional")} />
            <span className="purpose-card__icon"><BriefcaseBusiness size={24} /></span><strong>I provide services</strong><small>Start a draft professional application.</small>
          </label>
        </div>
        {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
        <button className="button button--primary button--large auth-submit" disabled={!purpose || pending}>
          {pending ? <LoaderCircle className="spin" size={19} /> : <ArrowRight size={19} />}{pending ? "Preparing your account…" : "Continue to FixMate"}
        </button>
      </form>
    </>
  );
}
