"use client";

import { ArrowRight, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useCallback, useState } from "react";

import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const handleToken = useCallback((value: string) => setToken(value), []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/auth/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: token }),
      });
      const result = (await response.json()) as ApiEnvelope<{ message: string }>;
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      sessionStorage.setItem("fixmate_otp_email_hint", email);
      router.push("/auth/verify");
    } catch {
      setError("We could not connect securely. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="auth-card__heading">
        <span className="auth-icon"><LockKeyhole size={22} /></span>
        <h2>Sign in or create your account</h2>
        <p>We’ll email you a one-time verification code. No password to remember.</p>
      </div>
      <form className="form-stack" onSubmit={submit} noValidate>
        <label className="field-label" htmlFor="email">Email address</label>
        <div className="input-with-icon">
          <Mail size={18} aria-hidden="true" />
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <TurnstileWidget action="request_otp" onToken={handleToken} />
        {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
        <button className="button button--primary button--large auth-submit" disabled={!token || pending}>
          {pending ? <LoaderCircle className="spin" size={19} /> : <ArrowRight size={19} />}
          {pending ? "Sending secure code…" : "Continue with email"}
        </button>
      </form>
      <p className="auth-privacy">By continuing, you agree to FixMate’s Terms and acknowledge the Privacy Policy. Required acceptance is recorded after verification.</p>
    </>
  );
}
