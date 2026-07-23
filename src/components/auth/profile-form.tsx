"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { ApiEnvelope } from "@/lib/api/response";

export function ProfileForm({ locale }: { locale: AppLocale }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: values.get("displayName"),
          phone: values.get("phone"),
          preferredLocale: values.get("preferredLocale"),
          acceptedPolicies: values.get("acceptedPolicies") === "on",
        }),
      });
      const result = (await response.json()) as ApiEnvelope<{ saved: boolean }>;
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      router.push("/auth/account-purpose");
      router.refresh();
    } catch {
      setError("Your profile could not be saved. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="auth-card__heading">
        <span className="auth-step">Step 1 of 2</span>
        <h2>Complete your basic profile</h2>
        <p>This helps FixMate communicate clearly and protect your account.</p>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <label className="field-label" htmlFor="displayName">Full name</label>
        <input className="text-input" id="displayName" name="displayName" autoComplete="name" minLength={2} maxLength={100} required />
        <label className="field-label" htmlFor="phone">Mobile number</label>
        <input className="text-input" id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+92 300 1234567" required />
        <label className="field-label" htmlFor="preferredLocale">Preferred language</label>
        <select className="text-input" id="preferredLocale" name="preferredLocale" defaultValue={locale}>
          <option value="en">English</option><option value="ur">اردو</option><option value="ur-Latn">Roman Urdu</option>
        </select>
        <label className="consent-check">
          <input type="checkbox" name="acceptedPolicies" required />
          <span>I accept the <Link href="/terms">Terms of Service</Link> and acknowledge the <Link href="/privacy">Privacy Policy</Link>.</span>
        </label>
        {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
        <button className="button button--primary button--large auth-submit" disabled={pending}>
          {pending ? <LoaderCircle className="spin" size={19} /> : <ArrowRight size={19} />}{pending ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </>
  );
}
