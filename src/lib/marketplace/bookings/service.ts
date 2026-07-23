import "server-only";

import type { AwaitedAuthenticatedContext } from "@/lib/professional/types";
import { decryptSensitiveValue } from "@/lib/security/encryption";
import { createAdminClient } from "@/lib/supabase/admin";

import { hashIdempotentRequest } from "../idempotency";
import type { BookingCancelInput, BookingRescheduleInput } from "./schemas";

const bookingSelection =
  "id,booking_reference,request_id,customer_id,professional_id,property_id,scheduled_start_at,scheduled_end_at,timezone,status,confirmation_status,reschedule_status,exact_address_released_at,confirmation_deadline_at,confirmed_at,cancelled_at,cancellation_reason,no_show_party,cancellation_fee_minor,professional_compensation_minor,version,created_at,service_requests(request_reference,title,description),accepted_offer_snapshots(commercial_terms),booking_reschedule_requests(id,requested_by,proposed_start_at,proposed_end_at,reason,status,response_deadline_at,responded_at),professional_profiles!bookings_professional_id_fkey(business_name,user_profiles(display_name)),customer_profiles!bookings_customer_id_fkey(user_profiles(display_name))";

export function participantRole(
  context: AwaitedAuthenticatedContext,
  booking: { customer_id: string; professional_id: string },
): "customer" | "professional" | "support" | "admin" | "super_admin" | null {
  if (booking.professional_id === context.profile.id) return "professional";
  if (booking.customer_id === context.profile.id) return "customer";
  if (context.roles.includes("super_admin")) return "super_admin";
  if (context.roles.includes("admin")) return "admin";
  if (context.roles.includes("support")) return "support";
  return null;
}

export async function listBookings(context: AwaitedAuthenticatedContext) {
  return context.supabase
    .from("bookings")
    .select(bookingSelection)
    .or(`customer_id.eq.${context.profile.id},professional_id.eq.${context.profile.id}`)
    .order("created_at", { ascending: false })
    .limit(50);
}

export async function listStaffBookings(context: AwaitedAuthenticatedContext) {
  return context.supabase
    .from("bookings")
    .select(bookingSelection)
    .order("created_at", { ascending: false })
    .limit(100);
}

export async function getBooking(context: AwaitedAuthenticatedContext, bookingId: string) {
  const result = await context.supabase
    .from("bookings")
    .select(`${bookingSelection},booking_status_history(id,from_status,to_status,actor_role,reason,metadata,created_at)`)
    .eq("id", bookingId)
    .single();
  if (result.error || !result.data) return { ...result, exactAddress: null, customerContact: null };

  const role = participantRole(context, result.data);
  if (role !== "professional" || !result.data.exact_address_released_at) {
    return { ...result, exactAddress: null, customerContact: null };
  }

  const { data: request } = await createAdminClient()
    .from("service_requests")
    .select("address_snapshot_encrypted,customer_contact_snapshot")
    .eq("id", result.data.request_id)
    .single();
  let exactAddress: Record<string, unknown> | null = null;
  if (request?.address_snapshot_encrypted) {
    try {
      exactAddress = JSON.parse(decryptSensitiveValue(request.address_snapshot_encrypted)) as Record<string, unknown>;
    } catch {
      exactAddress = null;
    }
  }
  return {
    ...result,
    exactAddress,
    customerContact: request?.customer_contact_snapshot ?? null,
  };
}

export async function confirmBooking(
  context: AwaitedAuthenticatedContext,
  bookingId: string,
  version: number,
  idempotencyKey: string,
) {
  return createAdminClient().rpc("confirm_booking", {
    p_actor_profile_id: context.profile.id,
    p_booking_id: bookingId,
    p_expected_version: version,
    p_idempotency_key: idempotencyKey,
    p_request_hash: hashIdempotentRequest({ bookingId, version }),
  });
}

export async function requestBookingReschedule(
  context: AwaitedAuthenticatedContext,
  bookingId: string,
  role: "customer" | "professional",
  input: BookingRescheduleInput,
) {
  return createAdminClient().rpc("request_booking_reschedule", {
    p_actor_profile_id: context.profile.id,
    p_actor_role: role,
    p_booking_id: bookingId,
    p_expected_version: input.version,
    p_proposed_start_at: input.proposedStartAt,
    p_proposed_end_at: input.proposedEndAt,
    p_reason: input.reason,
  });
}

export async function respondBookingReschedule(
  context: AwaitedAuthenticatedContext,
  bookingId: string,
  rescheduleId: string,
  accept: boolean,
) {
  return createAdminClient().rpc("respond_booking_reschedule", {
    p_actor_profile_id: context.profile.id,
    p_booking_id: bookingId,
    p_reschedule_id: rescheduleId,
    p_accept: accept,
  });
}

export async function previewBookingCancellation(
  context: AwaitedAuthenticatedContext,
  bookingId: string,
  role: "customer" | "professional" | "support" | "admin" | "super_admin",
) {
  return createAdminClient().rpc("preview_booking_cancellation", {
    p_actor_profile_id: context.profile.id,
    p_actor_role: role,
    p_booking_id: bookingId,
  });
}

export async function cancelBooking(
  context: AwaitedAuthenticatedContext,
  bookingId: string,
  role: "customer" | "professional" | "support" | "admin" | "super_admin",
  input: BookingCancelInput,
) {
  return createAdminClient().rpc("cancel_booking", {
    p_actor_profile_id: context.profile.id,
    p_actor_role: role,
    p_booking_id: bookingId,
    p_expected_version: input.version,
    p_reason: input.reason,
    p_policy_acknowledged: input.policyAcknowledged,
  });
}

export async function recordBookingNoShow(
  context: AwaitedAuthenticatedContext,
  bookingId: string,
  party: string,
  reason: string,
  evidenceReference: string,
) {
  return createAdminClient().rpc("record_booking_no_show", {
    p_actor_profile_id: context.profile.id,
    p_booking_id: bookingId,
    p_no_show_party: party,
    p_reason: reason,
    p_evidence_reference: evidenceReference,
  });
}
