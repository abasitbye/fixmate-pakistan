import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import process from "node:process";

import nextEnvironment from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnvironment;
loadEnvConfig(process.cwd());

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!configuredUrl || !serviceKey) throw new Error("Supabase server environment is required.");

const admin = createClient(new URL(configuredUrl).origin, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `phase2-request-${Date.now()}@fixmate.invalid`;
let authUserId;
let profileId;
let propertyId;
let requestId;

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function cleanup() {
  if (requestId) {
    await admin.from("domain_outbox").delete().eq("aggregate_id", requestId);
    await admin.from("audit_logs").delete().eq("entity_id", requestId);
    await admin.from("service_requests").delete().eq("id", requestId);
  }
  if (profileId) {
    await admin.from("audit_logs").delete().eq("actor_user_profile_id", profileId);
    await admin.from("notifications").delete().eq("user_profile_id", profileId);
  }
  if (propertyId) await admin.from("properties").delete().eq("id", propertyId);
  if (authUserId) {
    let deletion;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      deletion = await admin.auth.admin.deleteUser(authUserId);
      if (!deletion.error) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
    if (deletion?.error) throw deletion.error;
  }
}

try {
  let created;
  let createUserError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    ({ data: created, error: createUserError } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { display_name: "Phase 2 Integration Check" },
      }));
    if (!createUserError) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 400));
  }
  if (createUserError || !created.user) throw createUserError ?? new Error("Test user was not created.");
  authUserId = created.user.id;

  const { data: profile, error: profileError } = await admin.from("user_profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();
  if (profileError || !profile) throw profileError ?? new Error("Test profile was not created.");
  profileId = profile.id;

  const [{ data: zone }, { data: subcategory }] = await Promise.all([
    admin.from("service_zones").select("id,city_id").eq("is_active", true).limit(1).single(),
    admin.from("service_subcategories").select("id,category_id").eq("is_active", true).limit(1).single(),
  ]);
  if (!zone || !subcategory) throw new Error("Launch catalog is unavailable.");

  const { data: property, error: propertyError } = await admin.from("properties").insert({
    customer_profile_id: profileId,
    label: "Integration property",
    property_type: "house",
    address_line_1: "Private integration address",
    city_id: zone.city_id,
    service_zone_id: zone.id,
    is_default: true,
  }).select("id").single();
  if (propertyError || !property) throw propertyError ?? new Error("Test property was not created.");
  propertyId = property.id;

  const payload = {
    property_id: propertyId,
    service_category_id: subcategory.category_id,
    service_subcategory_id: subcategory.id,
    title: "Integration request",
    description: "This record verifies the atomic Phase 2 customer request commands.",
    urgency: "standard",
    service_mode: "on_site",
    pricing_preference: "fixed_price",
    preferred_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    preferred_start_time: "10:00",
    preferred_end_time: "12:00",
    flexibility_minutes: 60,
    address_snapshot_encrypted: "integration-test-ciphertext",
    customer_contact_snapshot: { displayName: "Integration Check" },
  };
  const createKey = `integration:${randomUUID()}`;
  const createHash = hash(payload);
  const { data: draft, error: draftError } = await admin.rpc("create_service_request_draft", {
    actor_profile_id: profileId,
    command_payload: payload,
    caller_idempotency_key: createKey,
    caller_request_hash: createHash,
  });
  if (draftError || !draft) throw draftError ?? new Error("Draft command failed.");
  requestId = draft.id;
  assert.equal(draft.status, "draft");
  assert.equal(draft.version, 1);

  const { data: replay, error: replayError } = await admin.rpc("create_service_request_draft", {
    actor_profile_id: profileId,
    command_payload: payload,
    caller_idempotency_key: createKey,
    caller_request_hash: createHash,
  });
  if (replayError || !replay) throw replayError ?? new Error("Idempotent replay failed.");
  assert.equal(replay.id, requestId);

  const submitKey = `integration-submit:${randomUUID()}`;
  const { data: submitted, error: submitError } = await admin.rpc("submit_service_request", {
    actor_profile_id: profileId,
    target_request_id: requestId,
    expected_version: 1,
    caller_idempotency_key: submitKey,
    caller_request_hash: hash({ requestId, version: 1 }),
  });
  if (submitError || !submitted) throw submitError ?? new Error("Submit command failed.");
  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.version, 2);

  const { data: cancelled, error: cancelError } = await admin.rpc("cancel_service_request", {
    actor_profile_id: profileId,
    target_request_id: requestId,
    expected_version: 2,
    cancellation_reason: "Integration verification complete",
    caller_idempotency_key: `integration-cancel:${randomUUID()}`,
    caller_request_hash: hash({ requestId, version: 2, reason: "Integration verification complete" }),
  });
  if (cancelError || !cancelled) throw cancelError ?? new Error("Cancel command failed.");
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.version, 3);

  const [{ count: requestCount }, { count: historyCount }, { count: notificationCount }] = await Promise.all([
    admin.from("service_requests").select("id", { count: "exact", head: true }).eq("id", requestId),
    admin.from("service_request_status_history").select("id", { count: "exact", head: true }).eq("request_id", requestId),
    admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_profile_id", profileId).eq("type", "service_request.submitted"),
  ]);
  assert.equal(requestCount, 1);
  assert.equal(historyCount, 3);
  assert.equal(notificationCount, 1);
  console.log("phase2-request-integration=passed create=1 replay=1 submit=1 cancel=1 history=3 notification=1");
} finally {
  await cleanup();
}
