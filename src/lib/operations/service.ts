import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function getMarketplaceOperationsSnapshot() {
  const admin = createAdminClient();
  const [
    requests,
    activeJobs,
    openDisputes,
    pendingPayouts,
    failedOutbox,
    alerts,
    risks,
    runs,
    recentRequests,
    recentJobs,
  ] = await Promise.all([
    admin
      .from("service_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["submitted", "matching", "offers_received", "no_match"]),
    admin
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .not("status", "in", '("completed","cancelled","closed")'),
    admin
      .from("job_disputes")
      .select("id", { count: "exact", head: true })
      .not("status", "in", '("resolved","rejected","closed")'),
    admin
      .from("professional_payouts")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "scheduled", "processing", "failed"]),
    admin
      .from("domain_outbox")
      .select("id", { count: "exact", head: true })
      .in("status", ["failed", "dead_letter"]),
    admin
      .from("operational_alerts")
      .select(
        "id,alert_code,severity,title,summary_safe,entity_type,entity_id,status,last_seen_at",
      )
      .neq("status", "resolved")
      .order("last_seen_at", { ascending: false })
      .limit(25),
    admin
      .from("marketplace_risk_signals")
      .select(
        "id,profile_id,signal_type,severity,evidence_summary_safe,reference_type,reference_id,status,last_detected_at",
      )
      .not("status", "in", '("dismissed","closed")')
      .order("last_detected_at", { ascending: false })
      .limit(25),
    admin
      .from("background_job_runs")
      .select(
        "id,job_code,trigger_source,status,started_at,finished_at,result_safe,error_safe",
      )
      .order("started_at", { ascending: false })
      .limit(10),
    admin
      .from("service_requests")
      .select("id,request_reference,title,status,matching_status,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("jobs")
      .select("id,job_reference,status,payment_status,dispute_status,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const firstError = [
    requests,
    activeJobs,
    openDisputes,
    pendingPayouts,
    failedOutbox,
    alerts,
    risks,
    runs,
    recentRequests,
    recentJobs,
  ].find((result) => result.error)?.error;

  if (firstError) {
    throw new Error("Marketplace operations snapshot could not be loaded.");
  }

  return {
    metrics: {
      activeRequests: requests.count ?? 0,
      activeJobs: activeJobs.count ?? 0,
      openDisputes: openDisputes.count ?? 0,
      pendingPayouts: pendingPayouts.count ?? 0,
      failedOutbox: failedOutbox.count ?? 0,
    },
    alerts: alerts.data ?? [],
    risks: risks.data ?? [],
    runs: runs.data ?? [],
    recentRequests: recentRequests.data ?? [],
    recentJobs: recentJobs.data ?? [],
  };
}

export async function reviewOperationalAlert(
  actorProfileId: string,
  alertId: string,
  status: "acknowledged" | "resolved",
  note: string,
) {
  return createAdminClient().rpc("review_operational_alert", {
    p_actor_profile_id: actorProfileId,
    p_alert_id: alertId,
    p_status: status,
    p_note: note,
  });
}

export async function reviewMarketplaceRisk(
  actorProfileId: string,
  signalId: string,
  status: "reviewing" | "dismissed" | "confirmed" | "appealed" | "closed",
  note: string,
) {
  return createAdminClient().rpc("review_marketplace_risk_signal", {
    p_actor_profile_id: actorProfileId,
    p_signal_id: signalId,
    p_status: status,
    p_note: note,
  });
}
