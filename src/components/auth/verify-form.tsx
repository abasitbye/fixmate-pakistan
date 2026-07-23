"use client";

import { ArrowLeft, ArrowRight, LoaderCircle, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

export function VerifyForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = (await response.json()) as ApiEnvelope<{ next: string }>;
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      sessionStorage.removeItem("fixmate_otp_email_hint");
      router.replace(result.data.next);
      router.refresh();
    } catch {
      setError("We could not verify the code. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Link href="/auth/sign-in" className="auth-back"><ArrowLeft size={16} /> Back to sign in</Link>
      <div className="auth-card__heading">
        <span className="otp-badge" aria-hidden="true">•••</span>
        <h2>Enter your verification code</h2>
        <p>We sent a one-time code to the email address you entered.</p>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <label className="field-label" htmlFor="otp">Verification code</label>
        <input className="otp-input" id="otp" name="otp" type="text" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" minLength={6} maxLength={8} required autoFocus value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 8))} aria-describedby="otp-help" />
        <p id="otp-help" className="field-help">The code expires shortly and can only be used once.</p>
        {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
        <button className="button button--primary button--large auth-submit" disabled={token.length < 6 || pending}>
          {pending ? <LoaderCircle className="spin" size={19} /> : <ArrowRight size={19} />}
          {pending ? "Verifying…" : "Verify and continue"}
        </button>
      </form>
      <Link href="/auth/sign-in" className="resend-link"><RotateCcw size={15} /> Need a new code? Return to sign in</Link>
    </>
  );
}
