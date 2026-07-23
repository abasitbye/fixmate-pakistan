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

const ids = { authUsers: [], profiles: [], properties: [], requests: [], offers: [], bookings: [], jobs: [] };
const tomorrow = new Date(Date.now() + 2 * 86_400_000);
const serviceDate = tomorrow.toISOString().slice(0, 10);
const dayOfWeek = tomorrow.getUTCDay();
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function createTestUser(kind) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `phase2-${kind}-${Date.now()}-${randomUUID()}@fixmate.invalid`,
    email_confirm: true,
    user_metadata: { display_name: `Phase 2 ${kind}` },
  });
  if (error || !data.user) throw error ?? new Error(`${kind} test user could not be created.`);
  ids.authUsers.push(data.user.id);
  const { data: profile, error: profileError } = await admin.from("user_profiles")
    .select("id").eq("auth_user_id", data.user.id).single();
  if (profileError || !profile) throw profileError ?? new Error(`${kind} profile was not created.`);
  ids.profiles.push(profile.id);
  return profile.id;
}

async function cleanup() {
  for (const jobId of ids.jobs) {
    await admin.from("domain_outbox").delete().eq("aggregate_id", jobId);
    await admin.from("audit_logs").delete().eq("entity_id", jobId);
    await admin.from("jobs").delete().eq("id", jobId);
  }
  for (const bookingId of ids.bookings) {
    await admin.from("domain_outbox").delete().eq("aggregate_id", bookingId);
    await admin.from("audit_logs").delete().eq("entity_id", bookingId);
    await admin.from("bookings").delete().eq("id", bookingId);
  }
  for (const requestId of ids.requests) {
    await admin.from("service_requests").update({ selected_offer_id: null }).eq("id", requestId);
    await admin.from("accepted_offer_snapshots").delete().eq("request_id", requestId);
    await admin.from("domain_outbox").delete().eq("aggregate_id", requestId);
    await admin.from("audit_logs").delete().eq("entity_id", requestId);
    await admin.from("service_requests").delete().eq("id", requestId);
  }
  for (const offerId of ids.offers) {
    await admin.from("domain_outbox").delete().eq("aggregate_id", offerId);
    await admin.from("audit_logs").delete().eq("entity_id", offerId);
  }
  for (const profileId of ids.profiles) {
    await admin.from("notifications").delete().eq("user_profile_id", profileId);
    await admin.from("audit_logs").delete().eq("actor_user_profile_id", profileId);
  }
  for (const propertyId of ids.properties) await admin.from("properties").delete().eq("id", propertyId);
  for (const authUserId of ids.authUsers) await admin.auth.admin.deleteUser(authUserId);
  const cleanupChecks = await Promise.all([
    admin.from("jobs").select("id", { count: "exact", head: true }).in("id", ids.jobs.length ? ids.jobs : [randomUUID()]),
    admin.from("bookings").select("id", { count: "exact", head: true }).in("id", ids.bookings.length ? ids.bookings : [randomUUID()]),
    admin.from("service_requests").select("id", { count: "exact", head: true }).in("id", ids.requests.length ? ids.requests : [randomUUID()]),
    admin.from("user_profiles").select("id", { count: "exact", head: true }).in("id", ids.profiles.length ? ids.profiles : [randomUUID()]),
  ]);
  for (const result of cleanupChecks) {
    if (result.error) throw result.error;
    assert.equal(result.count, 0);
  }
}

try {
  const customerId = await createTestUser("customer");
  const professionalId = await createTestUser("professional");
  const [{ data: zone }, { data: subcategory }, { data: professionalRole }, { data: requiredTypes }] = await Promise.all([
    admin.from("service_zones").select("id,city_id").eq("is_active", true).limit(1).single(),
    admin.from("service_subcategories").select("id,category_id").eq("is_active", true).limit(1).single(),
    admin.from("roles").select("id").eq("code", "professional").single(),
    admin.from("verification_types").select("id").eq("is_required", true).eq("is_active", true),
  ]);
  if (!zone || !subcategory || !professionalRole || !requiredTypes?.length) throw new Error("Marketplace prerequisites are unavailable.");

  const { error: professionalError } = await admin.from("professional_profiles").insert({
    user_profile_id: professionalId,
    application_status: "approved",
    business_name: "Integration Repairs",
    years_experience: 5,
    bio: "Internal professional used only for an automatically cleaned integration test.",
    primary_city_id: zone.city_id,
    travel_radius_km: 20,
    has_tools: true,
    has_transport: true,
    submitted_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
  });
  if (professionalError) throw professionalError;
  const setupResults = await Promise.all([
    admin.from("user_roles").upsert({ user_profile_id: professionalId, role_id: professionalRole.id, is_active: true }),
    admin.from("professional_services").insert({ professional_profile_id: professionalId, service_subcategory_id: subcategory.id, is_active: true }),
    admin.from("professional_service_areas").insert({ professional_profile_id: professionalId, service_zone_id: zone.id, is_active: true }),
    admin.from("professional_availability_schedules").insert({ professional_profile_id: professionalId, day_of_week: dayOfWeek, start_time: "08:00", end_time: "18:00", is_active: true }),
    admin.from("professional_verifications").insert(requiredTypes.map((type) => ({
      professional_profile_id: professionalId,
      verification_type_id: type.id,
      status: "verified",
      verified_at: new Date().toISOString(),
    }))),
  ]);
  const setupError = setupResults.find((result) => result.error)?.error;
  if (setupError) throw setupError;

  const { data: property, error: propertyError } = await admin.from("properties").insert({
    customer_profile_id: customerId,
    label: "Marketplace integration property",
    property_type: "house",
    address_line_1: "Private integration address",
    city_id: zone.city_id,
    service_zone_id: zone.id,
    is_default: true,
  }).select("id").single();
  if (propertyError || !property) throw propertyError ?? new Error("Property setup failed.");
  ids.properties.push(property.id);

  const requestPayload = {
    property_id: property.id,
    service_category_id: subcategory.category_id,
    service_subcategory_id: subcategory.id,
    title: "Marketplace integration request",
    description: "This internal request verifies matching, offer submission, and atomic acceptance.",
    urgency: "standard",
    service_mode: "on_site",
    pricing_preference: "fixed_price",
    preferred_date: serviceDate,
    preferred_start_time: "10:00",
    preferred_end_time: "12:00",
    flexibility_minutes: 60,
    address_snapshot_encrypted: "integration-test-ciphertext",
    customer_contact_snapshot: { displayName: "Integration Customer" },
  };
  const { data: draft, error: draftError } = await admin.rpc("create_service_request_draft", {
    actor_profile_id: customerId,
    command_payload: requestPayload,
    caller_idempotency_key: `integration:${randomUUID()}`,
    caller_request_hash: hash(requestPayload),
  });
  if (draftError || !draft) throw draftError ?? new Error("Request creation failed.");
  ids.requests.push(draft.id);
  const { data: submitted, error: submitError } = await admin.rpc("submit_service_request", {
    actor_profile_id: customerId,
    target_request_id: draft.id,
    expected_version: 1,
    caller_idempotency_key: `integration-submit:${randomUUID()}`,
    caller_request_hash: hash({ requestId: draft.id, version: 1 }),
  });
  if (submitError || !submitted) throw submitError ?? new Error("Request submission failed.");

  const { data: matchingRun, error: matchingError } = await admin.rpc("run_request_matching", {
    p_request_id: draft.id,
    p_actor_profile_id: customerId,
    p_batch_size: 5,
    p_strategy_version: "integration-v1",
  });
  if (matchingError || !matchingRun) throw matchingError ?? new Error("Matching failed.");
  assert.equal(matchingRun.invited_count, 1);

  const startAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const endAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const offerPayload = {
    offer_type: "fixed_price",
    callout_fee_minor: 5_000,
    labor_amount_minor: 50_000,
    material_estimate_minor: 20_000,
    minimum_amount_minor: "",
    maximum_amount_minor: "",
    inspection_fee_minor: 0,
    message: "Includes the listed repair labor and estimated replacement material.",
    estimated_duration_minutes: 120,
    proposed_start_at: startAt,
    proposed_end_at: endAt,
    includes_materials: true,
    warranty_days: 30,
    valid_until: validUntil,
    items: [{ item_type: "labor", description: "Repair labor", quantity: 1, unit: "job", unit_price_minor: 50_000 }],
  };
  const { data: offer, error: offerError } = await admin.rpc("save_professional_offer", {
    p_actor_profile_id: professionalId,
    p_request_id: draft.id,
    p_offer_id: null,
    p_expected_version: 0,
    p_payload: offerPayload,
  });
  if (offerError || !offer) throw offerError ?? new Error("Offer draft failed.");
  ids.offers.push(offer.id);
  const { data: submittedOffer, error: offerSubmitError } = await admin.rpc("submit_professional_offer", {
    p_actor_profile_id: professionalId,
    p_offer_id: offer.id,
    p_expected_version: offer.version,
    p_idempotency_key: `integration-offer:${randomUUID()}`,
    p_request_hash: hash({ offerId: offer.id, version: offer.version }),
  });
  if (offerSubmitError || !submittedOffer) throw offerSubmitError ?? new Error("Offer submission failed.");

  const { data: currentRequest, error: currentRequestError } = await admin.from("service_requests")
    .select("version,status").eq("id", draft.id).single();
  if (currentRequestError || !currentRequest) throw currentRequestError ?? new Error("Request refresh failed.");
  assert.equal(currentRequest.status, "offers_received");
  const acceptKey = `integration-accept:${randomUUID()}`;
  const acceptHash = hash({
    requestId: draft.id,
    offerId: offer.id,
    offerVersion: submittedOffer.version,
    requestVersion: currentRequest.version,
  });
  const acceptArgs = {
    p_actor_profile_id: customerId,
    p_request_id: draft.id,
    p_offer_id: offer.id,
    p_offer_version: submittedOffer.version,
    p_request_version: currentRequest.version,
    p_idempotency_key: acceptKey,
    p_request_hash: acceptHash,
  };
  const { data: booking, error: acceptError } = await admin.rpc("accept_professional_offer", acceptArgs);
  if (acceptError || !booking) throw acceptError ?? new Error("Offer acceptance failed.");
  ids.bookings.push(booking.id);
  assert.equal(booking.status, "pending_confirmation");
  assert.equal(booking.exact_address_released_at, null);

  const { data: replay, error: replayError } = await admin.rpc("accept_professional_offer", acceptArgs);
  if (replayError || !replay) throw replayError ?? new Error("Acceptance replay failed.");
  assert.equal(replay.id, booking.id);

  const rescheduledStart = new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString();
  const rescheduledEnd = new Date(Date.now() + 4.5 * 60 * 60 * 1000).toISOString();
  const { data: reschedule, error: rescheduleError } = await admin.rpc("request_booking_reschedule", {
    p_actor_profile_id: customerId,
    p_actor_role: "customer",
    p_booking_id: booking.id,
    p_expected_version: booking.version,
    p_proposed_start_at: rescheduledStart,
    p_proposed_end_at: rescheduledEnd,
    p_reason: "Integration test schedule proposal",
  });
  if (rescheduleError || !reschedule) throw rescheduleError ?? new Error("Reschedule request failed.");
  const { data: rescheduledBooking, error: responseError } = await admin.rpc("respond_booking_reschedule", {
    p_actor_profile_id: professionalId,
    p_booking_id: booking.id,
    p_reschedule_id: reschedule.id,
    p_accept: true,
  });
  if (responseError || !rescheduledBooking) throw responseError ?? new Error("Reschedule response failed.");
  assert.equal(rescheduledBooking.status, "rescheduled");
  assert.equal(new Date(rescheduledBooking.scheduled_start_at).getTime(), new Date(rescheduledStart).getTime());

  const confirmKey = `integration-confirm:${randomUUID()}`;
  const confirmHash = hash({ bookingId: booking.id, version: rescheduledBooking.version });
  const confirmArgs = {
    p_actor_profile_id: professionalId,
    p_booking_id: booking.id,
    p_expected_version: rescheduledBooking.version,
    p_idempotency_key: confirmKey,
    p_request_hash: confirmHash,
  };
  const { data: job, error: confirmError } = await admin.rpc("confirm_booking", confirmArgs);
  if (confirmError || !job) throw confirmError ?? new Error("Booking confirmation failed.");
  ids.jobs.push(job.id);
  assert.equal(job.status, "confirmed");
  const { data: confirmReplay, error: confirmReplayError } = await admin.rpc("confirm_booking", confirmArgs);
  if (confirmReplayError || !confirmReplay) throw confirmReplayError ?? new Error("Confirmation replay failed.");
  assert.equal(confirmReplay.id, job.id);

  const { data: confirmedBooking, error: confirmedBookingError } = await admin.from("bookings")
    .select("status,exact_address_released_at").eq("id", booking.id).single();
  if (confirmedBookingError || !confirmedBooking) throw confirmedBookingError ?? new Error("Confirmed booking refresh failed.");
  assert.equal(confirmedBooking.status, "converted_to_job");
  assert.ok(confirmedBooking.exact_address_released_at);

  const { data: enRouteJob, error: enRouteError } = await admin.rpc("mark_job_en_route", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_expected_version: job.version,
  });
  if (enRouteError || !enRouteJob) throw enRouteError ?? new Error("En-route transition failed.");
  assert.equal(enRouteJob.status, "en_route");

  const { data: codeRows, error: codeError } = await admin.rpc("regenerate_arrival_code", {
    p_actor_profile_id: customerId,
    p_job_id: job.id,
  });
  if (codeError || !codeRows?.length) throw codeError ?? new Error("Arrival code generation failed.");
  const arrivalCode = codeRows[0].arrival_code;
  assert.match(arrivalCode, /^\d{6}$/);
  const incorrectCode = String((Number(arrivalCode) + 1) % 1_000_000).padStart(6, "0");
  const { data: invalidRows, error: invalidError } = await admin.rpc("verify_arrival_code", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_code: incorrectCode,
  });
  if (invalidError || !invalidRows?.length) throw invalidError ?? new Error("Invalid-code path failed.");
  assert.equal(invalidRows[0].verification_status, "invalid");
  const { data: attemptRecord, error: attemptError } = await admin.from("arrival_verifications")
    .select("attempt_count,status").eq("id", codeRows[0].verification_id).single();
  if (attemptError || !attemptRecord) throw attemptError ?? new Error("Arrival attempt refresh failed.");
  assert.equal(attemptRecord.attempt_count, 1);
  assert.equal(attemptRecord.status, "active");

  const { data: locationSession, error: locationStartError } = await admin.rpc("start_job_location_session", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_consent: true,
    p_ip_address: null,
    p_user_agent: "FixMate integration test",
  });
  if (locationStartError || !locationSession) throw locationStartError ?? new Error("Location session start failed.");
  const { data: locationPoint, error: locationPointError } = await admin.rpc("record_job_location_point", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_latitude: 33.6844,
    p_longitude: 73.0479,
    p_accuracy_meters: 25,
  });
  if (locationPointError || !locationPoint) throw locationPointError ?? new Error("Location point failed.");

  const { data: verifiedRows, error: verifyError } = await admin.rpc("verify_arrival_code", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_code: arrivalCode,
  });
  if (verifyError || !verifiedRows?.length) throw verifyError ?? new Error("Arrival verification failed.");
  assert.equal(verifiedRows[0].verification_status, "verified");
  assert.equal(verifiedRows[0].verified_job_status, "arrived");
  const [{ data: endedSession }, { count: bookingHistoryCount }, { count: jobHistoryCount }] = await Promise.all([
    admin.from("job_location_sessions").select("status,ended_at").eq("id", locationSession.id).single(),
    admin.from("booking_status_history").select("id", { count: "exact", head: true }).eq("booking_id", booking.id),
    admin.from("job_status_history").select("id", { count: "exact", head: true }).eq("job_id", job.id),
  ]);
  assert.equal(endedSession?.status, "ended");
  assert.ok(endedSession?.ended_at);
  assert.ok((bookingHistoryCount ?? 0) >= 5);
  assert.equal(jobHistoryCount, 3);

  const { data: cancellationPreview, error: cancellationPreviewError } = await admin.rpc("preview_booking_cancellation", {
    p_actor_profile_id: customerId,
    p_actor_role: "customer",
    p_booking_id: booking.id,
  });
  if (cancellationPreviewError || !cancellationPreview) throw cancellationPreviewError ?? new Error("Cancellation preview failed.");
  assert.equal(cancellationPreview.feeMinor, 0);
  assert.equal(cancellationPreview.requiresAcknowledgement, false);
  const { error: postArrivalNoShowError } = await admin.rpc("record_booking_no_show", {
    p_actor_profile_id: customerId,
    p_booking_id: booking.id,
    p_no_show_party: "customer",
    p_reason: "Integration safety check must reject a no-show after verified arrival.",
    p_evidence_reference: "integration-case-001",
  });
  assert.match(postArrivalNoShowError?.message ?? "", /NO_SHOW_NOT_RECORDABLE/);
  const { error: postArrivalCancellationError } = await admin.rpc("cancel_booking", {
    p_actor_profile_id: customerId,
    p_actor_role: "customer",
    p_booking_id: booking.id,
    p_expected_version: 1,
    p_reason: "Integration safety check must reject cancellation after verified arrival.",
    p_policy_acknowledged: false,
  });
  assert.match(postArrivalCancellationError?.message ?? "", /BOOKING_NOT_CANCELLABLE/);

  const [{ count: snapshotCount }, { count: bookingCount }, { count: candidateCount }] = await Promise.all([
    admin.from("accepted_offer_snapshots").select("id", { count: "exact", head: true }).eq("request_id", draft.id),
    admin.from("bookings").select("id", { count: "exact", head: true }).eq("request_id", draft.id),
    admin.from("request_matching_candidates").select("id", { count: "exact", head: true }).eq("request_id", draft.id).eq("professional_id", professionalId),
  ]);
  assert.equal(snapshotCount, 1);
  assert.equal(bookingCount, 1);
  assert.equal(candidateCount, 1);
  console.log("phase2-marketplace-integration=passed match=1 invite=1 offer=1 accept=1 reschedule=1 confirm=1 confirm_replay=1 en_route=1 invalid_attempt_persisted=1 arrival=verified location_auto_stopped=1 cancellation_fee=0 post_arrival_no_show_blocked=1 post_arrival_cancel_blocked=1 cleanup=verified");
} finally {
  await cleanup();
}
