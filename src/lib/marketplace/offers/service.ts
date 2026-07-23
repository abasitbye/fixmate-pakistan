import "server-only";

import type { AwaitedAuthenticatedContext } from "@/lib/professional/types";
import { createAdminClient } from "@/lib/supabase/admin";

import { hashIdempotentRequest } from "../idempotency";
import type { OfferDraftInput } from "./schemas";
import { calculateOfferTotals } from "./totals";

function offerPayload(input: OfferDraftInput) {
  const totals = calculateOfferTotals(input);
  return {
    offer_type: input.offerType,
    callout_fee_minor: input.calloutFeeMinor,
    labor_amount_minor: input.laborAmountMinor,
    material_estimate_minor: input.materialEstimateMinor,
    minimum_amount_minor: input.minimumAmountMinor ?? "",
    maximum_amount_minor: input.maximumAmountMinor ?? "",
    inspection_fee_minor: input.inspectionFeeMinor,
    message: input.message,
    estimated_duration_minutes: input.estimatedDurationMinutes,
    proposed_start_at: input.proposedStartAt,
    proposed_end_at: input.proposedEndAt,
    includes_materials: input.includesMaterials,
    warranty_days: input.warrantyDays,
    valid_until: input.validUntil,
    total_amount_minor: totals.totalAmountMinor,
    items: input.items.map((item) => ({
      item_type: item.itemType,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_minor: item.unitPriceMinor,
    })),
  };
}

export async function saveProfessionalOffer(
  context: AwaitedAuthenticatedContext,
  requestId: string,
  input: OfferDraftInput,
  offerId?: string,
  expectedVersion = 0,
) {
  return createAdminClient().rpc("save_professional_offer", {
    p_actor_profile_id: context.profile.id,
    p_request_id: requestId,
    p_offer_id: offerId ?? null,
    p_expected_version: expectedVersion,
    p_payload: offerPayload(input),
  });
}

export async function submitProfessionalOffer(
  context: AwaitedAuthenticatedContext,
  offerId: string,
  version: number,
  idempotencyKey: string,
) {
  return createAdminClient().rpc("submit_professional_offer", {
    p_actor_profile_id: context.profile.id,
    p_offer_id: offerId,
    p_expected_version: version,
    p_idempotency_key: idempotencyKey,
    p_request_hash: hashIdempotentRequest({ offerId, version }),
  });
}

export async function withdrawProfessionalOffer(
  context: AwaitedAuthenticatedContext,
  offerId: string,
  version: number,
  reason: string,
) {
  return createAdminClient().rpc("withdraw_professional_offer", {
    p_actor_profile_id: context.profile.id,
    p_offer_id: offerId,
    p_expected_version: version,
    p_reason: reason,
  });
}

export async function listProfessionalOffers(context: AwaitedAuthenticatedContext) {
  return context.supabase.from("professional_offers")
    .select("id,offer_reference,request_id,offer_type,currency_code,minimum_amount_minor,maximum_amount_minor,total_amount_minor,inspection_fee_minor,message,proposed_start_at,proposed_end_at,warranty_days,valid_until,status,version,created_at,service_requests(request_reference,title)")
    .eq("professional_id", context.profile.id)
    .order("created_at", { ascending: false })
    .limit(50);
}

export async function listCustomerOffers(
  context: AwaitedAuthenticatedContext,
  requestId: string,
) {
  return context.supabase.from("professional_offers")
    .select("id,offer_reference,offer_type,currency_code,callout_fee_minor,labor_amount_minor,material_estimate_minor,minimum_amount_minor,maximum_amount_minor,total_amount_minor,inspection_fee_minor,message,estimated_duration_minutes,proposed_start_at,proposed_end_at,requires_inspection,includes_materials,warranty_days,valid_until,status,version,service_requests!inner(customer_id,version,status),professional_profiles!inner(user_profile_id,business_name,years_experience,bio,has_tools,has_transport,user_profiles!inner(display_name,avatar_path)),professional_offer_items(id,item_type,description,quantity,unit,unit_price_minor,amount_minor,display_order)")
    .eq("request_id", requestId)
    .eq("service_requests.customer_id", context.profile.id)
    .eq("status", "submitted")
    .order("total_amount_minor", { ascending: true });
}

export async function acceptProfessionalOffer(
  context: AwaitedAuthenticatedContext,
  requestId: string,
  offerId: string,
  offerVersion: number,
  requestVersion: number,
  idempotencyKey: string,
) {
  return createAdminClient().rpc("accept_professional_offer", {
    p_actor_profile_id: context.profile.id,
    p_request_id: requestId,
    p_offer_id: offerId,
    p_offer_version: offerVersion,
    p_request_version: requestVersion,
    p_idempotency_key: idempotencyKey,
    p_request_hash: hashIdempotentRequest({ requestId, offerId, offerVersion, requestVersion }),
  });
}
