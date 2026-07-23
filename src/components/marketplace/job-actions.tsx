"use client";

import { KeyRound, LoaderCircle, MapPin, Navigation, ShieldCheck, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

type Props = {
  jobId: string;
  role: "customer" | "professional";
  status: string;
  version: number;
  hasActiveLocationSession: boolean;
};

export function JobActions({ jobId, role, status, version, hasActiveLocationSession }: Props) {
  const router = useRouter();
  const watchId = useRef<number | null>(null);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [arrivalCode, setArrivalCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [sharing, setSharing] = useState(hasActiveLocationSession);

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  async function post<T>(path: string, body: unknown, action: string) {
    setPending(action);
    setError("");
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json() as ApiEnvelope<T>;
    setPending("");
    if (!result.success) {
      setError(result.error.message);
      return null;
    }
    return result.data;
  }

  async function markEnRoute() {
    const data = await post(`/api/v1/jobs/${jobId}/en-route`, { version }, "en-route");
    if (data) router.refresh();
  }

  async function generateCode() {
    const data = await post<{
      arrivalCode: string;
      expiresAt: string;
    }>(`/api/v1/jobs/${jobId}/arrival-code`, {}, "arrival-code");
    if (data) {
      setArrivalCode(data.arrivalCode);
      setExpiresAt(data.expiresAt);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = await post(`/api/v1/jobs/${jobId}/arrival-code/verify`, {
      code: form.get("code"),
    }, "verify-arrival");
    if (data) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      setSharing(false);
      router.refresh();
    }
  }

  async function sendPosition(position: GeolocationPosition) {
    const response = await fetch(`/api/v1/jobs/${jobId}/location/points`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
      }),
    });
    if (!response.ok) {
      const result = await response.json() as ApiEnvelope<never>;
      setError(result.success ? "Location sharing stopped." : result.error.message);
    }
  }

  async function startSharing() {
    if (!("geolocation" in navigator)) {
      setError("Location services are not available in this browser.");
      return;
    }
    if (!window.confirm("Share your live location with this customer only while you are en route? Sharing stops at arrival, when you stop it, or at expiry. FixMate does not request always-on background access.")) return;
    const data = await post(`/api/v1/jobs/${jobId}/location/start`, { consent: true }, "start-location");
    if (!data) return;
    setSharing(true);
    watchId.current = navigator.geolocation.watchPosition(
      (position) => void sendPosition(position),
      () => setError("Location access was denied or became unavailable."),
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 20_000 },
    );
  }

  async function stopSharing() {
    const data = await post(`/api/v1/jobs/${jobId}/location/stop`, {}, "stop-location");
    if (!data) return;
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setSharing(false);
    router.refresh();
  }

  return <section className="panel-card">
    <h2>Job actions</h2>
    {role === "professional" && status === "confirmed" ? <>
      <p>Mark en route only when travel has started and you are within the allowed time window.</p>
      <button className="button button--primary" onClick={markEnRoute} disabled={Boolean(pending)}>
        {pending === "en-route" ? <LoaderCircle className="spin" size={17} /> : <Navigation size={17} />} Mark en route
      </button>
    </> : null}

    {role === "customer" && ["confirmed", "en_route"].includes(status) ? <>
      <p>Generate a short-lived code only when the professional reaches your property. The professional cannot see it through FixMate.</p>
      <button className="button button--primary" onClick={generateCode} disabled={Boolean(pending)}>
        {pending === "arrival-code" ? <LoaderCircle className="spin" size={17} /> : <KeyRound size={17} />} Generate arrival code
      </button>
      {arrivalCode ? <div className="arrival-code" role="status">
        <small>Arrival code</small><strong>{arrivalCode}</strong>
        <span>Expires {new Date(expiresAt).toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi" })}. It will not be shown again after leaving this page.</span>
      </div> : null}
    </> : null}

    {role === "professional" && status === "en_route" ? <>
      <form className="arrival-form" onSubmit={verifyCode}>
        <label htmlFor="arrival-code"><span>Customer’s six-digit arrival code</span></label>
        <input id="arrival-code" className="text-input code-input" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
        <button className="button button--primary" disabled={Boolean(pending)}>
          {pending === "verify-arrival" ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />} Verify arrival
        </button>
      </form>
      <div className="action-block">
        <h3><MapPin size={17} /> Optional limited location sharing</h3>
        <p>Sharing is consent-based, visible, limited to this en-route window, and automatically stops after arrival or expiry.</p>
        {sharing
          ? <button className="button button--ghost" onClick={stopSharing} disabled={Boolean(pending)}><Square size={16} /> Stop sharing</button>
          : <button className="button button--ghost" onClick={startSharing} disabled={Boolean(pending)}><MapPin size={16} /> Start sharing</button>}
      </div>
    </> : null}

    {["arrived", "inspecting", "awaiting_quotation"].includes(status) ? <p><ShieldCheck size={16} /> Arrival is verified. The next Phase 2 checkpoint will add inspection and quotations.</p> : null}
    {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
  </section>;
}
