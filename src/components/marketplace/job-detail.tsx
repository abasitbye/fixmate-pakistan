import { CalendarClock, History, MapPin, ShieldCheck, Wrench } from "lucide-react";

import { Link } from "@/i18n/navigation";

import { JobActions } from "./job-actions";

type Relation<T> = T | T[] | null;
type LocationSession = {
  id: string;
  status: string;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  job_location_points: Array<{
    latitude: number;
    longitude: number;
    accuracy_meters: number | null;
    recorded_at: string;
  }>;
};
type Job = {
  id: string;
  job_reference: string;
  booking_id: string;
  status: string;
  work_status: string;
  payment_status: string;
  warranty_status: string;
  scheduled_start_at: string;
  actual_en_route_at: string | null;
  actual_arrived_at: string | null;
  version: number;
  service_requests: Relation<{ request_reference: string; title: string; description: string }>;
  service_subcategories: Relation<{ name_en: string }>;
  job_status_history: Array<{ id: number; to_status: string; actor_role: string | null; created_at: string }>;
  job_location_sessions: LocationSession[];
};

function one<T>(value: Relation<T>) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function JobDetail({
  job,
  role,
  exactAddress,
  arrivalVerification,
}: {
  job: Job;
  role: "customer" | "professional";
  exactAddress?: Record<string, unknown> | null;
  arrivalVerification?: {
    status: string;
    expires_at: string;
    attempt_count: number;
    max_attempts: number;
    verified_at: string | null;
  } | null;
}) {
  const request = one(job.service_requests);
  const service = one(job.service_subcategories);
  const activeSession = (job.job_location_sessions ?? []).find((session) => session.status === "active");
  const locationPoints = activeSession?.job_location_points ?? [];
  const latestPoint = [...locationPoints].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  )[0];
  const history = [...(job.job_status_history ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return <>
    <div className="dashboard-heading">
      <div><span className="section-kicker">{job.job_reference}</span><h1>{request?.title ?? "Service job"}</h1><p>{request?.description}</p></div>
      <span className="status-chip">{job.status.replaceAll("_", " ")}</span>
    </div>
    <div className="metric-grid">
      <article className="metric-card"><Wrench size={20} /><span>Service</span><strong>{service?.name_en ?? "Service"}</strong></article>
      <article className="metric-card"><CalendarClock size={20} /><span>Scheduled</span><strong>{new Date(job.scheduled_start_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</strong></article>
      <article className="metric-card"><ShieldCheck size={20} /><span>Arrival</span><strong>{job.actual_arrived_at ? "Verified" : job.actual_en_route_at ? "En route" : "Not started"}</strong></article>
    </div>
    <div className="dashboard-grid dashboard-grid--main">
      <div className="card-list">
        {role === "professional" && exactAddress ? <section className="panel-card"><h2>Service address</h2><p><strong>{String(exactAddress.label ?? "Service property")}</strong></p><p>{String(exactAddress.addressLine1 ?? "")}{exactAddress.addressLine2 ? `, ${String(exactAddress.addressLine2)}` : ""}</p>{exactAddress.accessNotes ? <p><strong>Access notes:</strong> {String(exactAddress.accessNotes)}</p> : null}</section> : null}
        {role === "customer" ? <section className="panel-card">
          <h2><MapPin size={18} /> Limited location sharing</h2>
          {activeSession ? <>
            <p>Location sharing is active until {new Date(activeSession.expires_at).toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi" })} or verified arrival.</p>
            {latestPoint ? <div className="location-reading"><strong>Latest consented update</strong><span>{Number(latestPoint.latitude).toFixed(5)}, {Number(latestPoint.longitude).toFixed(5)}</span><small>{new Date(latestPoint.recorded_at).toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi" })}{latestPoint.accuracy_meters ? ` · reported accuracy ${Math.round(latestPoint.accuracy_meters)} m` : ""}</small></div> : <p>Waiting for the first location update. FixMate does not claim live GPS accuracy until a point is received.</p>}
          </> : <p>The professional is not actively sharing location. Sharing is optional and limited to the en-route job window.</p>}
        </section> : null}
        {role === "customer" && arrivalVerification ? <section className="panel-card"><h2>Arrival verification security</h2><p>Status: <strong>{arrivalVerification.status}</strong></p><p>Attempts used: {arrivalVerification.attempt_count} of {arrivalVerification.max_attempts}</p><p>The stored code is hashed and is never returned to the professional.</p></section> : null}
        <section className="panel-card">
          <h2><History size={18} /> Job history</h2>
          <div className="timeline-list">{history.map((entry) => <div key={entry.id}><span className="timeline-dot" /><div><strong>{entry.to_status.replaceAll("_", " ")}</strong><p>{entry.actor_role ?? "system"} · {new Date(entry.created_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</p></div></div>)}</div>
        </section>
      </div>
      <div>
        <JobActions jobId={job.id} role={role} status={job.status} version={job.version} hasActiveLocationSession={Boolean(activeSession)} />
        <Link className="dashboard-back" href={`/${role}/jobs`}>Back to jobs</Link>
      </div>
    </div>
  </>;
}
