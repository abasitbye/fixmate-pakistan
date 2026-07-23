import {
  Activity,
  AlertTriangle,
  BriefcaseBusiness,
  Clock3,
  HandCoins,
  ShieldAlert,
  Workflow,
} from "lucide-react";

import { getMarketplaceOperationsSnapshot } from "@/lib/operations/service";

import { OperationsReviewForm } from "./operations-review-form";

function pakistanTime(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  }).format(new Date(value));
}

export async function OperationsDashboard() {
  const snapshot = await getMarketplaceOperationsSnapshot();
  const metrics = [
    ["Active requests", snapshot.metrics.activeRequests, Workflow],
    ["Active jobs", snapshot.metrics.activeJobs, BriefcaseBusiness],
    ["Open disputes", snapshot.metrics.openDisputes, ShieldAlert],
    ["Pending payouts", snapshot.metrics.pendingPayouts, HandCoins],
    ["Failed background events", snapshot.metrics.failedOutbox, AlertTriangle],
  ] as const;

  return (
    <>
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">Marketplace control room</span>
          <h1>Operations and risk</h1>
          <p>
            Live workload, background processing, deadlines, and reviewable
            safety signals. Signals never trigger an opaque automatic ban.
          </p>
        </div>
        <span className="status-chip status-chip--success">
          <Activity size={16} /> Operational view
        </span>
      </div>

      <section className="metric-grid" aria-label="Marketplace workload">
        {metrics.map(([label, value, Icon]) => (
          <article className="metric-card" key={label}>
            <span>
              <Icon size={21} />
            </span>
            <strong>{value}</strong>
            <p>{label}</p>
          </article>
        ))}
      </section>

      <section className="panel-card">
        <div className="dashboard-heading">
          <div>
            <h2>Operational alerts</h2>
            <p>Deadline, queue, and processing issues requiring staff review.</p>
          </div>
        </div>
        {snapshot.alerts.length ? (
          <div className="card-list">
            {snapshot.alerts.map((alert) => (
              <article className="setting-row" key={alert.id}>
                <span className="panel-icon">
                  <AlertTriangle size={20} />
                </span>
                <div>
                  <h3>{alert.title}</h3>
                  <p>{alert.summary_safe}</p>
                  <small>
                    {alert.alert_code} · {pakistanTime(alert.last_seen_at)}
                  </small>
                  <OperationsReviewForm id={alert.id} kind="alert" />
                </div>
                <span className="status-chip">
                  {alert.severity} · {alert.status}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p>No unresolved operational alerts.</p>
        )}
      </section>

      <section className="panel-card">
        <div className="dashboard-heading">
          <div>
            <h2>Fraud and abuse review</h2>
            <p>
              Explainable signals for human review, documented outcomes, and
              appeal support.
            </p>
          </div>
        </div>
        {snapshot.risks.length ? (
          <div className="card-list">
            {snapshot.risks.map((risk) => (
              <article className="setting-row" key={risk.id}>
                <span className="panel-icon">
                  <ShieldAlert size={20} />
                </span>
                <div>
                  <h3>{risk.signal_type.replaceAll("_", " ")}</h3>
                  <p>{risk.evidence_summary_safe}</p>
                  <small>
                    Profile {risk.profile_id} ·{" "}
                    {pakistanTime(risk.last_detected_at)}
                  </small>
                  <OperationsReviewForm id={risk.id} kind="risk" />
                </div>
                <span className="status-chip">
                  {risk.severity} · {risk.status}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p>No open automated risk signals.</p>
        )}
      </section>

      <section className="panel-card">
        <div className="dashboard-heading">
          <div>
            <h2>Scheduled maintenance</h2>
            <p>
              Daily lifecycle expiry, retention cleanup, risk detection, and
              retry-exhaustion monitoring.
            </p>
          </div>
        </div>
        {snapshot.runs.length ? (
          <div className="timeline-list">
            {snapshot.runs.map((run) => (
              <div key={run.id}>
                <span className="timeline-dot" />
                <div>
                  <strong>
                    {run.job_code.replaceAll("_", " ")} · {run.status}
                  </strong>
                  <p>
                    <Clock3 size={14} /> {pakistanTime(run.started_at)} ·{" "}
                    {run.trigger_source}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>The first scheduled run has not occurred yet.</p>
        )}
      </section>

      <section className="panel-card">
        <div className="dashboard-heading">
          <div>
            <h2>Recent marketplace activity</h2>
            <p>Safe operational references without addresses or private chat.</p>
          </div>
        </div>
        <div className="admin-table">
          <div className="admin-table__head">
            <span>Reference</span>
            <span>Type</span>
            <span>Status</span>
            <span>Created</span>
          </div>
          {snapshot.recentRequests.map((request) => (
            <div className="admin-table__row" key={request.id}>
              <span>
                <strong>{request.request_reference}</strong>
                <small>{request.title}</small>
              </span>
              <span>Request</span>
              <span className="status-chip">{request.status}</span>
              <span>{pakistanTime(request.created_at)}</span>
            </div>
          ))}
          {snapshot.recentJobs.map((job) => (
            <div className="admin-table__row" key={job.id}>
              <span>
                <strong>{job.job_reference}</strong>
                <small>Payment: {job.payment_status}</small>
              </span>
              <span>Job</span>
              <span className="status-chip">{job.status}</span>
              <span>{pakistanTime(job.created_at)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
