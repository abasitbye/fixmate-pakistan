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

const ids = { authUsers: [], profiles: [], properties: [], requests: [], offers: [], bookings: [], jobs: [], webhookEvents: [] };
const tomorrow = new Date(Date.now() + 2 * 86_400_000);
const serviceDate = tomorrow.toISOString().slice(0, 10);
const dayOfWeek = tomorrow.getUTCDay();
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function createTestUser(kind) {
  let data;
  let error;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    ({ data, error } = await admin.auth.admin.createUser({
      email: `phase2-${kind}-${Date.now()}-${randomUUID()}@fixmate.invalid`,
      email_confirm: true,
      user_metadata: { display_name: `Phase 2 ${kind}` },
    }));
    if (!error || error.code !== "bad_jwt") break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 400));
  }
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
    const { data: paymentIntents } = await admin.from("payment_intents").select("id").eq("job_id", jobId);
    const paymentIntentIds = paymentIntents?.map((item) => item.id) ?? [];
    if (paymentIntentIds.length) {
      const { data: payoutRows } = await admin.from("professional_payouts").select("id").in(
        "professional_id",
        ids.profiles.length ? ids.profiles : [randomUUID()],
      );
      const payoutIds = payoutRows?.map((item) => item.id) ?? [];
      await admin.from("ledger_entries").delete().in("payment_intent_id", paymentIntentIds);
      if (payoutIds.length) {
        await admin.from("ledger_entries").delete().in("payout_id", payoutIds);
        await admin.from("payout_earning_items").delete().in("payout_id", payoutIds);
        await admin.from("professional_payouts").delete().in("id", payoutIds);
      }
      await admin.from("transaction_documents").delete().in("payment_intent_id", paymentIntentIds);
      await admin.from("payment_reconciliation_cases").delete().in("payment_intent_id", paymentIntentIds);
      await admin.from("refunds").delete().in("payment_intent_id", paymentIntentIds);
      await admin.from("professional_earnings").delete().in("payment_intent_id", paymentIntentIds);
      await admin.from("payment_transactions").delete().in("payment_intent_id", paymentIntentIds);
      await admin.from("payment_intents").delete().in("id", paymentIntentIds);
    }
    const [{ data: disputeRows }, { data: claimRows }, { data: warrantyRows }, { data: reviewRows }] = await Promise.all([
      admin.from("job_disputes").select("id").eq("job_id", jobId),
      admin.from("warranty_claims").select("id").eq("job_id", jobId),
      admin.from("job_warranties").select("id").eq("job_id", jobId),
      admin.from("job_reviews").select("id").eq("job_id", jobId),
    ]);
    const disputeIds = disputeRows?.map((item) => item.id) ?? [];
    const claimIds = claimRows?.map((item) => item.id) ?? [];
    const warrantyIds = warrantyRows?.map((item) => item.id) ?? [];
    const reviewIds = reviewRows?.map((item) => item.id) ?? [];
    const resolutionEntityIds = [...disputeIds, ...claimIds, ...warrantyIds, ...reviewIds];
    if (resolutionEntityIds.length) {
      await admin.from("audit_logs").delete().in("entity_id", resolutionEntityIds);
      await admin.from("domain_outbox").delete().in("aggregate_id", resolutionEntityIds);
    }
    if (disputeIds.length) {
      await admin.from("marketplace_account_actions").delete().in("dispute_id", disputeIds);
      await admin.from("dispute_decisions").delete().in("dispute_id", disputeIds);
      await admin.from("dispute_messages").delete().in("dispute_id", disputeIds);
      await admin.from("dispute_evidence").delete().in("dispute_id", disputeIds);
      await admin.from("dispute_status_history").delete().in("dispute_id", disputeIds);
      await admin.from("job_disputes").delete().in("id", disputeIds);
    }
    if (claimIds.length) await admin.from("warranty_claim_evidence").delete().in("claim_id", claimIds);
    await admin.from("warranty_claims").delete().eq("job_id", jobId);
    await admin.from("job_warranties").delete().eq("job_id", jobId);
    await admin.from("job_reviews").delete().eq("job_id", jobId);
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
    await admin.from("transaction_documents").delete().eq("issued_to_user_id", profileId);
    await admin.from("notifications").delete().eq("user_profile_id", profileId);
    await admin.from("audit_logs").delete().eq("actor_user_profile_id", profileId);
  }
  if (ids.webhookEvents.length) await admin.from("payment_webhook_events").delete().in("id", ids.webhookEvents);
  await admin.from("professional_rating_aggregates").delete().in("professional_id", ids.profiles.length ? ids.profiles : [randomUUID()]);
  await admin.from("ledger_accounts").delete().in("owner_profile_id", ids.profiles.length ? ids.profiles : [randomUUID()]);
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
    admin.from("professional_payout_profiles").upsert({
      professional_profile_id: professionalId,
      payout_method: "bank",
      account_title: "Integration Repairs",
      account_reference_encrypted: "integration-test-encrypted-reference",
      is_verified: true,
    }),
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

  const paymentKey = `integration-payment:${randomUUID()}`;
  const paymentHash = hash({ jobId: job.id, provider: "manual", methodType: "manual_bank_transfer", paymentMethodId: null });
  const paymentArgs = {
    p_actor_profile_id: customerId,
    p_job_id: job.id,
    p_provider: "manual",
    p_method_type: "manual_bank_transfer",
    p_payment_method_id: null,
    p_idempotency_key: paymentKey,
    p_request_hash: paymentHash,
  };
  const { data: payment, error: paymentError } = await admin.rpc("create_job_payment_intent", paymentArgs);
  if (paymentError || !payment) throw paymentError ?? new Error("Payment intent creation failed.");
  assert.equal(payment.amount_minor, 78_000);
  assert.equal(payment.platform_fee_minor, 0);
  assert.equal(payment.status, "cash_due");
  const { data: paymentReplay, error: paymentReplayError } = await admin.rpc("create_job_payment_intent", paymentArgs);
  if (paymentReplayError || !paymentReplay) throw paymentReplayError ?? new Error("Payment intent replay failed.");
  assert.equal(paymentReplay.id, payment.id);

  const { data: reportedPayment, error: reportPaymentError } = await admin.rpc("report_manual_payment", {
    p_actor_profile_id: professionalId,
    p_payment_intent_id: payment.id,
    p_note: "Integration manual transfer reported for customer verification.",
  });
  if (reportPaymentError || !reportedPayment) throw reportPaymentError ?? new Error("Manual payment report failed.");
  assert.equal(reportedPayment.status, "cash_reported");
  const { data: disagreement, error: disagreementError } = await admin.rpc("open_payment_disagreement", {
    p_actor_profile_id: customerId,
    p_payment_intent_id: payment.id,
    p_reason: "Integration test checks the documented disagreement and reconciliation path.",
  });
  if (disagreementError || !disagreement) throw disagreementError ?? new Error("Payment disagreement failed.");
  const { data: reconciled, error: reconciliationError } = await admin.rpc("reconcile_manual_payment", {
    p_actor_profile_id: professionalId,
    p_actor_role: "support",
    p_case_id: disagreement.id,
    p_resolution: "Integration review rejected the first receipt report so the professional can report again.",
    p_confirmed: false,
    p_evidence_reference: "integration-reconciliation-001",
  });
  if (reconciliationError || !reconciled) throw reconciliationError ?? new Error("Payment reconciliation failed.");
  assert.equal(reconciled.status, "resolved");
  const { data: rereportedPayment, error: rereportError } = await admin.rpc("report_manual_payment", {
    p_actor_profile_id: professionalId,
    p_payment_intent_id: payment.id,
    p_note: "Integration manual transfer reported again after staff review.",
  });
  if (rereportError || !rereportedPayment) throw rereportError ?? new Error("Manual payment re-report failed.");

  const confirmPaymentKey = `integration-payment-confirm:${randomUUID()}`;
  const confirmPaymentArgs = {
    p_actor_profile_id: customerId,
    p_payment_intent_id: payment.id,
    p_idempotency_key: confirmPaymentKey,
    p_request_hash: hash({ paymentId: payment.id }),
  };
  const { data: confirmedPayment, error: paymentConfirmError } = await admin.rpc("confirm_manual_payment", confirmPaymentArgs);
  if (paymentConfirmError || !confirmedPayment) throw paymentConfirmError ?? new Error("Manual payment confirmation failed.");
  assert.equal(confirmedPayment.status, "cash_confirmed");
  const { data: confirmedPaymentReplay, error: paymentConfirmReplayError } = await admin.rpc("confirm_manual_payment", confirmPaymentArgs);
  if (paymentConfirmReplayError || !confirmedPaymentReplay) throw paymentConfirmReplayError ?? new Error("Payment confirmation replay failed.");
  assert.equal(confirmedPaymentReplay.id, payment.id);

  const [{ data: journalRows }, { data: earning }, { data: receipt }] = await Promise.all([
    admin.from("ledger_entries").select("journal_id,direction,amount_minor").eq("payment_intent_id", payment.id),
    admin.from("professional_earnings").select("*").eq("payment_intent_id", payment.id).single(),
    admin.from("transaction_documents").select("*").eq("payment_intent_id", payment.id).eq("document_type", "customer_receipt").single(),
  ]);
  assert.ok(journalRows?.length);
  const debitTotal = journalRows.filter((row) => row.direction === "debit").reduce((sum, row) => sum + Number(row.amount_minor), 0);
  const creditTotal = journalRows.filter((row) => row.direction === "credit").reduce((sum, row) => sum + Number(row.amount_minor), 0);
  assert.equal(debitTotal, creditTotal);
  assert.equal(earning?.status, "available");
  assert.equal(earning?.net_amount_minor, 78_000);
  assert.match(receipt?.wording ?? "", /not a tax invoice/i);

  const { data: warranty, error: warrantyError } = await admin.from("job_warranties")
    .select("*").eq("job_id", job.id).single();
  if (warrantyError || !warranty) throw warrantyError ?? new Error("Warranty issuance failed.");
  assert.equal(warranty.status, "active");
  const { data: claim, error: claimError } = await admin.rpc("create_warranty_claim", {
    p_actor_profile_id: customerId,
    p_warranty_id: warranty.id,
    p_description: "The integration warranty claim verifies the documented response and revisit workflow.",
  });
  if (claimError || !claim) throw claimError ?? new Error("Warranty claim failed.");
  const { data: respondedClaim, error: claimResponseError } = await admin.rpc("respond_warranty_claim", {
    p_actor_profile_id: professionalId,
    p_claim_id: claim.id,
    p_response: "I reviewed the issue and will complete a warranty revisit.",
  });
  if (claimResponseError || !respondedClaim) throw claimResponseError ?? new Error("Warranty response failed.");
  const { data: scheduledClaim, error: claimScheduleError } = await admin.rpc("schedule_warranty_revisit", {
    p_actor_profile_id: professionalId,
    p_actor_role: "professional",
    p_claim_id: claim.id,
    p_scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
  if (claimScheduleError || !scheduledClaim) throw claimScheduleError ?? new Error("Warranty revisit failed.");
  const { data: resolvedClaim, error: claimResolveError } = await admin.rpc("resolve_warranty_claim", {
    p_actor_profile_id: customerId,
    p_actor_role: "customer",
    p_claim_id: claim.id,
    p_resolution: "The warranty revisit corrected the reported issue.",
    p_resolved: true,
  });
  if (claimResolveError || !resolvedClaim) throw claimResolveError ?? new Error("Warranty resolution failed.");
  assert.equal(resolvedClaim.status, "resolved");

  const { data: customerReview, error: customerReviewError } = await admin.rpc("submit_job_review", {
    p_actor_profile_id: customerId, p_job_id: job.id, p_actor_role: "customer",
    p_payload: { rating_overall: 5, rating_quality: 5, rating_timeliness: 4, rating_communication: 5, rating_value: 5, comment: "Professional integration review." },
  });
  if (customerReviewError || !customerReview) throw customerReviewError ?? new Error("Customer review failed.");
  const { data: professionalReview, error: professionalReviewError } = await admin.rpc("submit_job_review", {
    p_actor_profile_id: professionalId, p_job_id: job.id, p_actor_role: "professional",
    p_payload: { rating_overall: 5, rating_quality: 5, rating_timeliness: 5, rating_communication: 5, rating_value: 5, comment: "Customer integration review." },
  });
  if (professionalReviewError || !professionalReview) throw professionalReviewError ?? new Error("Professional review failed.");
  const { data: publishedReview, error: moderationError } = await admin.rpc("moderate_job_review", {
    p_actor_profile_id: professionalId, p_actor_role: "support", p_review_id: customerReview.id,
    p_status: "published", p_reason: "Integration moderation passed.",
  });
  if (moderationError || !publishedReview) throw moderationError ?? new Error("Review moderation failed.");
  const { data: aggregate } = await admin.from("professional_rating_aggregates").select("*").eq("professional_id", professionalId).single();
  assert.equal(aggregate?.published_review_count, 1);
  assert.equal(Number(aggregate?.rating_overall), 5);

  const disputeKey = `integration-dispute:${randomUUID()}`;
  const disputeInput = {
    jobId: job.id, reasonCategory: "payment_disagreement",
    description: "Integration dispute verifies holds, messages, evidence, resolution, closure, and reopening.",
    requestedResolution: "Review the recorded payment and release the correct professional amount.",
    contactPreference: "in_app",
  };
  const disputeArgs = {
    p_actor_profile_id: customerId, p_job_id: job.id, p_reason_category: disputeInput.reasonCategory,
    p_description: disputeInput.description, p_requested_resolution: disputeInput.requestedResolution,
    p_contact_preference: disputeInput.contactPreference, p_idempotency_key: disputeKey,
    p_request_hash: hash(disputeInput),
  };
  const { data: dispute, error: disputeError } = await admin.rpc("open_job_dispute", disputeArgs);
  if (disputeError || !dispute) throw disputeError ?? new Error("Dispute opening failed.");
  assert.equal(dispute.payment_hold_amount_minor, 78_000);
  const { data: disputeReplay, error: disputeReplayError } = await admin.rpc("open_job_dispute", disputeArgs);
  if (disputeReplayError || !disputeReplay) throw disputeReplayError ?? new Error("Dispute replay failed.");
  assert.equal(disputeReplay.id, dispute.id);
  const blockedPayoutKey = `integration-held-payout:${randomUUID()}`;
  const { error: heldPayoutError } = await admin.rpc("create_professional_payout", {
    p_actor_profile_id: customerId,
    p_actor_role: "admin",
    p_professional_id: professionalId,
    p_earning_ids: [earning.id],
    p_idempotency_key: blockedPayoutKey,
    p_request_hash: hash({ professionalId, earningIds: [earning.id] }),
  });
  assert.match(heldPayoutError?.message ?? "", /PAYOUT_EARNINGS_NOT_AVAILABLE/);
  const { data: disputeMessage, error: disputeMessageError } = await admin.rpc("send_dispute_message", {
    p_actor_profile_id: professionalId, p_actor_role: "professional", p_dispute_id: dispute.id,
    p_body: "The professional statement is preserved in the shared dispute timeline.", p_visibility: "shared",
  });
  if (disputeMessageError || !disputeMessage) throw disputeMessageError ?? new Error("Dispute message failed.");
  const { data: evidenceId, error: evidenceError2 } = await admin.rpc("add_resolution_evidence", {
    p_actor_profile_id: customerId, p_actor_role: "customer", p_case_type: "dispute", p_case_id: dispute.id,
    p_evidence_type: "document", p_storage_path: `disputes/${dispute.id}/integration.pdf`,
    p_mime_type: "application/pdf", p_file_size: 1024, p_description: "Integration dispute evidence.",
    p_visibility: "shared",
  });
  if (evidenceError2 || !evidenceId) throw evidenceError2 ?? new Error("Dispute evidence failed.");
  const { data: reviewedDispute, error: workflowError } = await admin.rpc("update_dispute_workflow", {
    p_actor_profile_id: professionalId, p_actor_role: "support", p_dispute_id: dispute.id,
    p_action: "propose", p_value: "Review found the payment record accurate and recommends releasing the held earning.",
  });
  if (workflowError || !reviewedDispute) throw workflowError ?? new Error("Dispute workflow failed.");
  const { data: resolvedDispute, error: disputeResolveError } = await admin.rpc("resolve_job_dispute", {
    p_actor_profile_id: customerId, p_actor_role: "admin", p_dispute_id: dispute.id,
    p_decision_type: "no_action", p_customer_refund_minor: 0, p_professional_release_minor: 78_000,
    p_platform_fee_adjustment_minor: 0, p_account_target_id: null,
    p_reason: "The evidence confirms the payment and approved work; release the held earning.",
  });
  if (disputeResolveError || !resolvedDispute) throw disputeResolveError ?? new Error("Dispute resolution failed.");
  assert.equal(resolvedDispute.status, "resolved");
  const { error: unauthorizedCloseError } = await admin.rpc("transition_resolved_dispute", {
    p_actor_profile_id: randomUUID(), p_actor_role: "customer", p_dispute_id: dispute.id,
    p_action: "close", p_reason: "An unrelated account must not be able to close this dispute.",
  });
  assert.match(unauthorizedCloseError?.message ?? "", /DISPUTE_CLOSE_FORBIDDEN/);
  const { data: closedDispute, error: closeError } = await admin.rpc("transition_resolved_dispute", {
    p_actor_profile_id: customerId, p_actor_role: "customer", p_dispute_id: dispute.id,
    p_action: "close", p_reason: "The documented resolution is acknowledged.",
  });
  if (closeError || !closedDispute) throw closeError ?? new Error("Dispute closure failed.");
  const { data: reopenedDispute, error: reopenError } = await admin.rpc("transition_resolved_dispute", {
    p_actor_profile_id: professionalId, p_actor_role: "support", p_dispute_id: dispute.id,
    p_action: "reopen", p_reason: "Integration appeal check reopens the resolved case for authorized review.",
  });
  if (reopenError || !reopenedDispute) throw reopenError ?? new Error("Dispute reopening failed.");
  const { data: reresolvedDispute, error: reresolveError } = await admin.rpc("resolve_job_dispute", {
    p_actor_profile_id: customerId, p_actor_role: "admin", p_dispute_id: dispute.id,
    p_decision_type: "no_action", p_customer_refund_minor: 0, p_professional_release_minor: 0,
    p_platform_fee_adjustment_minor: 0, p_account_target_id: null,
    p_reason: "Authorized appeal review confirms the original evidence-based resolution.",
  });
  if (reresolveError || !reresolvedDispute) throw reresolveError ?? new Error("Reopened dispute resolution failed.");

  const payoutKey = `integration-payout:${randomUUID()}`;
  const payoutArgs = {
    p_actor_profile_id: customerId,
    p_actor_role: "admin",
    p_professional_id: professionalId,
    p_earning_ids: [earning.id],
    p_idempotency_key: payoutKey,
    p_request_hash: hash({ professionalId, earningIds: [earning.id] }),
  };
  const { data: payout, error: payoutError } = await admin.rpc("create_professional_payout", payoutArgs);
  if (payoutError || !payout) throw payoutError ?? new Error("Payout draft failed.");
  const { error: makerCheckerError } = await admin.rpc("approve_professional_payout", {
    p_actor_profile_id: customerId, p_actor_role: "admin", p_payout_id: payout.id,
  });
  assert.match(makerCheckerError?.message ?? "", /PAYOUT_MAKER_CHECKER_REQUIRED/);
  const { data: approvedPayout, error: payoutApprovalError } = await admin.rpc("approve_professional_payout", {
    p_actor_profile_id: professionalId, p_actor_role: "admin", p_payout_id: payout.id,
  });
  if (payoutApprovalError || !approvedPayout) throw payoutApprovalError ?? new Error("Payout approval failed.");
  const { data: paidPayout, error: payoutPaidError } = await admin.rpc("record_professional_payout_paid", {
    p_actor_profile_id: customerId,
    p_actor_role: "admin",
    p_payout_id: payout.id,
    p_provider_reference: `integration-transfer-${randomUUID()}`,
    p_evidence_storage_path: `payouts/${payout.id}/integration-evidence.pdf`,
  });
  if (payoutPaidError || !paidPayout) throw payoutPaidError ?? new Error("Payout settlement failed.");
  assert.equal(paidPayout.status, "paid");

  const refundKey = `integration-refund:${randomUUID()}`;
  const refundArgs = {
    p_actor_profile_id: customerId,
    p_payment_intent_id: payment.id,
    p_amount_minor: 8_000,
    p_reason: "Integration partial refund validates accounting reversals and receipt generation.",
    p_idempotency_key: refundKey,
    p_request_hash: hash({ paymentId: payment.id, amountMinor: 8_000, reason: "Integration partial refund validates accounting reversals and receipt generation." }),
  };
  const { data: refund, error: refundError } = await admin.rpc("request_payment_refund", refundArgs);
  if (refundError || !refund) throw refundError ?? new Error("Refund request failed.");
  const { data: refundReplay, error: refundReplayError } = await admin.rpc("request_payment_refund", refundArgs);
  if (refundReplayError || !refundReplay) throw refundReplayError ?? new Error("Refund replay failed.");
  assert.equal(refundReplay.id, refund.id);
  const { data: approvedRefund, error: refundDecisionError } = await admin.rpc("decide_payment_refund", {
    p_actor_profile_id: professionalId,
    p_actor_role: "admin",
    p_refund_id: refund.id,
    p_approved: true,
    p_reason: "Integration approval after evidence review.",
  });
  if (refundDecisionError || !approvedRefund) throw refundDecisionError ?? new Error("Refund approval failed.");
  const { data: completedRefund, error: refundCompletionError } = await admin.rpc("complete_manual_refund", {
    p_actor_profile_id: customerId,
    p_actor_role: "admin",
    p_refund_id: refund.id,
    p_provider_reference: `integration-refund-transfer-${randomUUID()}`,
  });
  if (refundCompletionError || !completedRefund) throw refundCompletionError ?? new Error("Refund completion failed.");
  assert.equal(completedRefund.status, "completed");

  const webhookEventId = `integration-event-${randomUUID()}`;
  const webhookHash = hash({ event: webhookEventId });
  const { data: webhookEvent, error: webhookError } = await admin.rpc("record_payment_webhook_event", {
    p_provider: "integration_adapter", p_provider_event_id: webhookEventId,
    p_signature_verified: true, p_event_type: "payment.test", p_payload_hash: webhookHash,
  });
  if (webhookError || !webhookEvent) throw webhookError ?? new Error("Webhook recording failed.");
  ids.webhookEvents.push(webhookEvent.id);
  const { data: webhookReplay, error: webhookReplayError } = await admin.rpc("record_payment_webhook_event", {
    p_provider: "integration_adapter", p_provider_event_id: webhookEventId,
    p_signature_verified: true, p_event_type: "payment.test", p_payload_hash: webhookHash,
  });
  if (webhookReplayError || !webhookReplay) throw webhookReplayError ?? new Error("Webhook replay failed.");
  assert.equal(webhookReplay.id, webhookEvent.id);

  const [{ count: snapshotCount }, { count: bookingCount }, { count: candidateCount }] = await Promise.all([
    admin.from("accepted_offer_snapshots").select("id", { count: "exact", head: true }).eq("request_id", draft.id),
    admin.from("bookings").select("id", { count: "exact", head: true }).eq("request_id", draft.id),
    admin.from("request_matching_candidates").select("id", { count: "exact", head: true }).eq("request_id", draft.id).eq("professional_id", professionalId),
  ]);
  assert.equal(snapshotCount, 1);
  assert.equal(bookingCount, 1);
  assert.equal(candidateCount, 1);
  console.log("phase2-marketplace-integration=passed match=1 invite=1 offer=1 accept=1 reschedule=1 confirm=1 en_route=1 arrival=verified inspection=1 quotation_versions=2 quotation_approved=1 work_started=1 chat_read=1 change_order_approved=1 completion_issue=1 completion_confirmed=1 payment_confirmed=1 reconciliation=1 ledger_balanced=1 warranty_issued=1 claim_resolved=1 mutual_reviews=1 moderation=1 rating_aggregate=1 dispute_hold=1 held_payout_blocked=1 dispute_resolved=1 unauthorized_close_blocked=1 dispute_reopened=1 payout_paid=1 maker_checker=1 refund_completed=1 webhook_idempotent=1 safety_guards=2");
} finally {
  await cleanup();
}
