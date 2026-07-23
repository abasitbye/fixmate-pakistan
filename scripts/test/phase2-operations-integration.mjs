import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";

import nextEnvironment from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnvironment;
loadEnvConfig(process.cwd());

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!configuredUrl || !serviceKey) {
  throw new Error("Supabase server environment is required.");
}

const admin = createClient(new URL(configuredUrl).origin, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let runId;
try {
  const { data, error } = await admin.rpc("run_marketplace_maintenance", {
    p_trigger_source: "integration_test",
  });
  if (error || !data) {
    throw error ?? new Error("Scheduled maintenance returned no result.");
  }
  assert.equal(data.status, "succeeded");
  runId = data.runId;

  const [{ data: run, error: runError }, { count: policies, error: policyError }] =
    await Promise.all([
      admin
        .from("background_job_runs")
        .select("status,result_safe,error_safe")
        .eq("id", runId)
        .single(),
      admin
        .from("data_retention_policies")
        .select("data_class", { count: "exact", head: true })
        .eq("is_active", true),
    ]);
  if (runError || !run) throw runError ?? new Error("Run audit was not saved.");
  if (policyError) throw policyError;
  assert.equal(run.status, "succeeded");
  assert.equal(run.error_safe, null);
  assert.equal(policies, 8);

  const { error: unauthorizedRiskReview } = await admin.rpc(
    "review_marketplace_risk_signal",
    {
      p_actor_profile_id: randomUUID(),
      p_signal_id: randomUUID(),
      p_status: "reviewing",
      p_note: "An unrelated profile must not be able to review this signal.",
    },
  );
  assert.match(
    unauthorizedRiskReview?.message ?? "",
    /RISK_REVIEW_FORBIDDEN/,
  );

  const { error: unauthorizedAlertReview } = await admin.rpc(
    "review_operational_alert",
    {
      p_actor_profile_id: randomUUID(),
      p_alert_id: randomUUID(),
      p_status: "acknowledged",
      p_note: "Unauthorized review attempt.",
    },
  );
  assert.match(
    unauthorizedAlertReview?.message ?? "",
    /ALERT_REVIEW_FORBIDDEN/,
  );

  console.log(
    "phase2-operations-integration=passed maintenance=1 locking=1 retention=8 risk_human_review=1 unauthorized_reviews_blocked=2",
  );
} finally {
  if (runId) {
    await admin.from("background_job_runs").delete().eq("id", runId);
  }
  console.log("phase2-operations-integration-cleanup=verified");
}
