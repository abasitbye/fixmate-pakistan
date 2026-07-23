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
    const [{ data: quotations }, { data: messages }] = await Promise.all([
      admin.from("job_quotations").select("id").eq("job_id", jobId),
      admin.from("job_messages").select("id").eq("job_id", jobId),
    ]);
    const quotationIds = quotations?.map((item) => item.id) ?? [];
    const messageIds = messages?.map((item) => item.id) ?? [];
    if (messageIds.length) {
      await admin.from("job_message_reads").delete().in("message_id", messageIds);
      await admin.from("job_message_attachments").delete().in("message_id", messageIds);
    }
    await admin.from("job_messages").delete().eq("job_id", jobId);
    await admin.from("job_completions").delete().eq("job_id", jobId);
    await admin.from("job_change_orders").delete().eq("job_id", jobId);
    await admin.from("job_material_items").delete().eq("job_id", jobId);
    if (quotationIds.length) {
      await admin.from("quotation_decisions").delete().in("quotation_id", quotationIds);
      await admin.from("job_quotation_items").delete().in("quotation_id", quotationIds);
    }
    await admin.from("job_quotations").delete().eq("job_id", jobId);
    await admin.from("job_media").delete().eq("job_id", jobId);
    await admin.from("job_inspections").delete().eq("job_id", jobId);
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
  for (const authUserId of ids.authUsers) {
    let deletion = await admin.auth.admin.deleteUser(authUserId);
    if (deletion.error) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      deletion = await admin.auth.admin.deleteUser(authUserId);
    }
    if (deletion.error) throw deletion.error;
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
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
  console.log("phase2-marketplace-integration-cleanup=verified");
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

  const { data: arrivedJob, error: arrivedJobError } = await admin.from("jobs")
    .select("version,status").eq("id", job.id).single();
  if (arrivedJobError || !arrivedJob) throw arrivedJobError ?? new Error("Arrived job refresh failed.");
  const { data: inspection, error: inspectionStartError } = await admin.rpc("start_job_inspection", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_expected_version: arrivedJob.version,
  });
  if (inspectionStartError || !inspection) throw inspectionStartError ?? new Error("Inspection start failed.");
  const { data: completedInspection, error: inspectionCompleteError } = await admin.rpc("complete_job_inspection", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_inspection_id: inspection.id,
    p_expected_version: inspection.version,
    p_findings: "The integration inspection found a replaceable failed component.",
    p_recommended_work: "Replace the failed component and verify safe operation under load.",
    p_safety_notes: "Power must remain isolated while the component is replaced.",
  });
  if (inspectionCompleteError || !completedInspection) throw inspectionCompleteError ?? new Error("Inspection completion failed.");

  const quotationPayload = {
    deposit_required_minor: 0,
    estimated_duration_minutes: 120,
    warranty_days: 30,
    terms: "Work is limited to the itemized repair after explicit customer approval.",
    exclusions: "Unrelated hidden damage is excluded and requires a change order.",
    notes: "Integration quotation version one.",
    valid_until: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    items: [
      { item_type: "labor", description: "Approved repair labor", quantity: 1, unit: "job", unit_price_minor: 50_000, display_order: 0 },
      { item_type: "material", description: "Replacement component", quantity: 1, unit: "item", unit_price_minor: 20_000, material_source: "professional", display_order: 1 },
    ],
  };
  const { data: quotationV1, error: quotationV1Error } = await admin.rpc("save_job_quotation", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_quotation_id: null,
    p_expected_version: 0,
    p_payload: quotationPayload,
  });
  if (quotationV1Error || !quotationV1) throw quotationV1Error ?? new Error("Quotation v1 save failed.");
  const { data: submittedV1, error: submittedV1Error } = await admin.rpc("submit_job_quotation", {
    p_actor_profile_id: professionalId,
    p_quotation_id: quotationV1.id,
    p_expected_version: quotationV1.version,
    p_idempotency_key: `integration-quotation-v1:${randomUUID()}`,
    p_request_hash: hash({ quotationId: quotationV1.id, version: quotationV1.version }),
  });
  if (submittedV1Error || !submittedV1) throw submittedV1Error ?? new Error("Quotation v1 submit failed.");
  const { data: revisionRequested, error: revisionError } = await admin.rpc("decide_job_quotation", {
    p_actor_profile_id: customerId,
    p_quotation_id: submittedV1.id,
    p_expected_version: submittedV1.version,
    p_decision: "revision_requested",
    p_reason: "Please clarify the replacement component and retain the same warranty.",
    p_idempotency_key: `integration-quotation-revision:${randomUUID()}`,
    p_request_hash: hash({ quotationId: submittedV1.id, decision: "revision_requested" }),
  });
  if (revisionError || !revisionRequested) throw revisionError ?? new Error("Quotation revision request failed.");
  assert.equal(revisionRequested.status, "revised");

  const quotationV2Payload = {
    ...quotationPayload,
    notes: "Integration quotation version two with clarified material responsibility.",
  };
  const { data: quotationV2, error: quotationV2Error } = await admin.rpc("save_job_quotation", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_quotation_id: null,
    p_expected_version: 0,
    p_payload: quotationV2Payload,
  });
  if (quotationV2Error || !quotationV2) throw quotationV2Error ?? new Error("Quotation v2 save failed.");
  assert.equal(quotationV2.version_number, 2);
  const { data: submittedV2, error: submittedV2Error } = await admin.rpc("submit_job_quotation", {
    p_actor_profile_id: professionalId,
    p_quotation_id: quotationV2.id,
    p_expected_version: quotationV2.version,
    p_idempotency_key: `integration-quotation-v2:${randomUUID()}`,
    p_request_hash: hash({ quotationId: quotationV2.id, version: quotationV2.version }),
  });
  if (submittedV2Error || !submittedV2) throw submittedV2Error ?? new Error("Quotation v2 submit failed.");
  const { data: approvedQuotation, error: approvalError } = await admin.rpc("decide_job_quotation", {
    p_actor_profile_id: customerId,
    p_quotation_id: submittedV2.id,
    p_expected_version: submittedV2.version,
    p_decision: "approved",
    p_reason: "",
    p_idempotency_key: `integration-quotation-approve:${randomUUID()}`,
    p_request_hash: hash({ quotationId: submittedV2.id, decision: "approved" }),
  });
  if (approvalError || !approvedQuotation) throw approvalError ?? new Error("Quotation approval failed.");
  assert.equal(approvedQuotation.status, "approved");

  const { data: approvedJob, error: approvedJobError } = await admin.from("jobs")
    .select("version,status").eq("id", job.id).single();
  if (approvedJobError || !approvedJob) throw approvedJobError ?? new Error("Approved job refresh failed.");
  const { data: workingJob, error: workStartError } = await admin.rpc("start_job_work", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_expected_version: approvedJob.version,
  });
  if (workStartError || !workingJob) throw workStartError ?? new Error("Work start failed.");
  assert.equal(workingJob.status, "in_progress");

  const { data: customerMessage, error: messageError } = await admin.rpc("send_job_message", {
    p_actor_profile_id: customerId,
    p_actor_role: "customer",
    p_job_id: job.id,
    p_body: "Please confirm when the replacement component has been installed.",
    p_reply_to_message_id: null,
  });
  if (messageError || !customerMessage) throw messageError ?? new Error("Job message failed.");
  const { data: messageRead, error: messageReadError } = await admin.rpc("mark_job_message_read", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_message_id: customerMessage.id,
  });
  if (messageReadError || !messageRead) throw messageReadError ?? new Error("Message read failed.");

  const changePayload = {
    reason: "Additional hidden wear was discovered during approved work.",
    description: "Replace one additional worn connector before final testing.",
    evidence_summary: "During-work evidence shows the worn connector.",
    labor_change_minor: 5_000,
    material_change_minor: 3_000,
    other_change_minor: 0,
    schedule_change_minutes: 30,
    emergency_safety_exception: false,
    emergency_justification: "",
  };
  const { data: changeOrder, error: changeSaveError } = await admin.rpc("save_job_change_order", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_change_order_id: null,
    p_expected_version: 0,
    p_payload: changePayload,
  });
  if (changeSaveError || !changeOrder) throw changeSaveError ?? new Error("Change order save failed.");
  const { data: submittedChange, error: changeSubmitError } = await admin.rpc("submit_job_change_order", {
    p_actor_profile_id: professionalId,
    p_change_order_id: changeOrder.id,
    p_expected_version: changeOrder.version,
  });
  if (changeSubmitError || !submittedChange) throw changeSubmitError ?? new Error("Change order submit failed.");
  const { data: pausedForApproval } = await admin.from("jobs").select("status").eq("id", job.id).single();
  assert.equal(pausedForApproval?.status, "paused");
  const { data: approvedChange, error: changeDecisionError } = await admin.rpc("decide_job_change_order", {
    p_actor_profile_id: customerId,
    p_change_order_id: submittedChange.id,
    p_decision: "approved",
    p_reason: "",
  });
  if (changeDecisionError || !approvedChange) throw changeDecisionError ?? new Error("Change order approval failed.");
  const { data: pausedJob } = await admin.from("jobs").select("version").eq("id", job.id).single();
  const { data: resumedJob, error: resumeError } = await admin.rpc("resume_job_work", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_expected_version: pausedJob.version,
  });
  if (resumeError || !resumedJob) throw resumeError ?? new Error("Work resume failed.");

  const { error: evidenceError } = await admin.from("job_media").insert({
    job_id: job.id,
    uploaded_by: professionalId,
    media_stage: "after_work",
    media_type: "image",
    storage_path: `${professionalId}/${job.id}/integration-after-work.jpg`,
    mime_type: "image/jpeg",
    file_size: 1024,
    caption: "Integration-only final evidence record.",
  });
  if (evidenceError) throw evidenceError;
  const { data: completion, error: completionError } = await admin.rpc("submit_job_completion", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_expected_version: resumedJob.version,
    p_summary: "Replaced the failed component and additional approved connector, then verified safe operation.",
    p_outstanding_notes: "Customer should monitor normal operation during the warranty period.",
  });
  if (completionError || !completion) throw completionError ?? new Error("Completion submission failed.");
  assert.equal(completion.final_price_minor, 78_000);
  const { data: issueCompletion, error: issueError } = await admin.rpc("decide_job_completion", {
    p_actor_profile_id: customerId,
    p_job_id: job.id,
    p_decision: "issue_reported",
    p_notes: "Please recheck the final connector seating before I confirm completion.",
    p_idempotency_key: `integration-completion-issue:${randomUUID()}`,
    p_request_hash: hash({ jobId: job.id, decision: "issue_reported" }),
  });
  if (issueError || !issueCompletion) throw issueError ?? new Error("Completion issue report failed.");
  const { data: issueJob } = await admin.from("jobs").select("version,status").eq("id", job.id).single();
  assert.equal(issueJob?.status, "in_progress");
  const { data: resubmittedCompletion, error: resubmitError } = await admin.rpc("submit_job_completion", {
    p_actor_profile_id: professionalId,
    p_job_id: job.id,
    p_expected_version: issueJob.version,
    p_summary: "Rechecked and secured the connector seating, then repeated the safe-operation test.",
    p_outstanding_notes: "No outstanding work remains.",
  });
  if (resubmitError || !resubmittedCompletion) throw resubmitError ?? new Error("Completion resubmission failed.");
  const { data: confirmedCompletion, error: completionConfirmError } = await admin.rpc("decide_job_completion", {
    p_actor_profile_id: customerId,
    p_job_id: job.id,
    p_decision: "confirmed",
    p_notes: "The corrected work is complete.",
    p_idempotency_key: `integration-completion-confirm:${randomUUID()}`,
    p_request_hash: hash({ jobId: job.id, decision: "confirmed" }),
  });
  if (completionConfirmError || !confirmedCompletion) throw completionConfirmError ?? new Error("Completion confirmation failed.");
  assert.equal(confirmedCompletion.customer_decision, "confirmed");

  const [{ count: snapshotCount }, { count: bookingCount }, { count: candidateCount }] = await Promise.all([
    admin.from("accepted_offer_snapshots").select("id", { count: "exact", head: true }).eq("request_id", draft.id),
    admin.from("bookings").select("id", { count: "exact", head: true }).eq("request_id", draft.id),
    admin.from("request_matching_candidates").select("id", { count: "exact", head: true }).eq("request_id", draft.id).eq("professional_id", professionalId),
  ]);
  assert.equal(snapshotCount, 1);
  assert.equal(bookingCount, 1);
  assert.equal(candidateCount, 1);
  console.log("phase2-marketplace-integration=passed match=1 invite=1 offer=1 accept=1 reschedule=1 confirm=1 en_route=1 arrival=verified inspection=1 quotation_versions=2 quotation_approved=1 work_started=1 chat_read=1 change_order_approved=1 completion_issue=1 completion_confirmed=1 safety_guards=2");
} finally {
  await cleanup();
}
