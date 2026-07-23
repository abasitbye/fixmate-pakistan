import "server-only";

import type { AwaitedAuthenticatedContext } from "@/lib/professional/types";
import { encryptSensitiveValue } from "@/lib/security/encryption";
import { createAdminClient } from "@/lib/supabase/admin";

import { hashIdempotentRequest } from "../idempotency";
import type { RequestDraftInput } from "./schemas";

const requestSelection =
  "id,request_reference,property_id,service_category_id,service_subcategory_id,title,description,urgency,service_mode,pricing_preference,preferred_date,preferred_start_time,preferred_end_time,flexibility_minutes,status,matching_status,offer_deadline,expires_at,submitted_at,cancelled_at,cancellation_reason,version,created_at,updated_at,properties(id,label,property_type,city_id,service_zone_id),service_categories(id,slug,name_en,name_ur,name_roman_ur),service_subcategories(id,slug,name_en,name_ur,name_roman_ur)";

export async function listCustomerRequests(context: AwaitedAuthenticatedContext) {
  return context.supabase
    .from("service_requests")
    .select(requestSelection)
    .eq("customer_id", context.profile.id)
    .order("created_at", { ascending: false })
    .limit(50);
}

export async function getCustomerRequest(
  context: AwaitedAuthenticatedContext,
  requestId: string,
) {
  return context.supabase
    .from("service_requests")
    .select(`${requestSelection},service_request_media(id,media_type,mime_type,file_size,caption,created_at)`)
    .eq("id", requestId)
    .eq("customer_id", context.profile.id)
    .single();
}

async function requestCommandPayload(
  context: AwaitedAuthenticatedContext,
  input: RequestDraftInput,
) {
  const { data: property, error } = await context.supabase
    .from("properties")
    .select("id,label,property_type,address_line_1,address_line_2,postal_code,access_notes,city_id,service_zone_id")
    .eq("id", input.propertyId)
    .eq("customer_profile_id", context.profile.id)
    .eq("is_active", true)
    .single();
  if (error || !property) throw new Error("PROPERTY_NOT_AVAILABLE");

  return {
    property_id: input.propertyId,
    service_category_id: input.serviceCategoryId,
    service_subcategory_id: input.serviceSubcategoryId,
    title: input.title,
    description: input.description,
    urgency: input.urgency,
    service_mode: "on_site",
    pricing_preference: input.pricingPreference,
    preferred_date: input.preferredDate || "",
    preferred_start_time: input.preferredStartTime || "",
    preferred_end_time: input.preferredEndTime || "",
    flexibility_minutes: input.flexibilityMinutes,
    address_snapshot_encrypted: encryptSensitiveValue(JSON.stringify({
      label: property.label,
      propertyType: property.property_type,
      addressLine1: property.address_line_1,
      addressLine2: property.address_line_2,
      postalCode: property.postal_code,
      accessNotes: property.access_notes,
    })),
    customer_contact_snapshot: {
      displayName: context.profile.display_name,
      phone: context.profile.phone,
    },
  };
}

export async function createCustomerRequest(
  context: AwaitedAuthenticatedContext,
  input: RequestDraftInput,
  idempotencyKey: string,
) {
  const payload = await requestCommandPayload(context, input);
  return createAdminClient().rpc("create_service_request_draft", {
    actor_profile_id: context.profile.id,
    command_payload: payload,
    caller_idempotency_key: idempotencyKey,
    caller_request_hash: hashIdempotentRequest(input),
  });
}

export async function updateCustomerRequest(
  context: AwaitedAuthenticatedContext,
  requestId: string,
  input: RequestDraftInput & { version: number },
) {
  const payload = await requestCommandPayload(context, input);
  return createAdminClient().rpc("update_service_request_draft", {
    actor_profile_id: context.profile.id,
    target_request_id: requestId,
    expected_version: input.version,
    command_payload: payload,
  });
}

export async function submitCustomerRequest(
  context: AwaitedAuthenticatedContext,
  requestId: string,
  version: number,
  idempotencyKey: string,
) {
  return createAdminClient().rpc("submit_service_request", {
    actor_profile_id: context.profile.id,
    target_request_id: requestId,
    expected_version: version,
    caller_idempotency_key: idempotencyKey,
    caller_request_hash: hashIdempotentRequest({ requestId, version }),
  });
}

export async function cancelCustomerRequest(
  context: AwaitedAuthenticatedContext,
  requestId: string,
  version: number,
  reason: string,
  idempotencyKey: string,
) {
  return createAdminClient().rpc("cancel_service_request", {
    actor_profile_id: context.profile.id,
    target_request_id: requestId,
    expected_version: version,
    cancellation_reason: reason,
    caller_idempotency_key: idempotencyKey,
    caller_request_hash: hashIdempotentRequest({ requestId, version, reason }),
  });
}
