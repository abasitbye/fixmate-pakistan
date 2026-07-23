import "server-only";

import type { AwaitedAuthenticatedContext } from "@/lib/professional/types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function runRequestMatching(
  requestId: string,
  actorProfileId: string,
  batchSize = 5,
) {
  return createAdminClient().rpc("run_request_matching", {
    p_request_id: requestId,
    p_actor_profile_id: actorProfileId,
    p_batch_size: batchSize,
    p_strategy_version: "zone-availability-fairness-v1",
  });
}

const safeInvitationSelection =
  "id,request_id,invitation_status,invited_at,viewed_at,responded_at,expires_at,decline_reason,service_requests!inner(id,request_reference,title,description,urgency,pricing_preference,preferred_date,preferred_start_time,preferred_end_time,flexibility_minutes,service_zones(name,cities(name)),service_categories(name_en,name_ur,name_roman_ur),service_subcategories(name_en,name_ur,name_roman_ur))";

export async function listProfessionalInvitations(context: AwaitedAuthenticatedContext) {
  return createAdminClient().from("request_matching_candidates")
    .select(safeInvitationSelection)
    .eq("professional_id", context.profile.id)
    .in("invitation_status", ["sent", "delivered", "viewed", "offer_submitted"])
    .order("invited_at", { ascending: false })
    .limit(50);
}

export async function getProfessionalInvitation(
  context: AwaitedAuthenticatedContext,
  invitationId: string,
) {
  return createAdminClient().from("request_matching_candidates")
    .select(safeInvitationSelection)
    .eq("id", invitationId)
    .eq("professional_id", context.profile.id)
    .single();
}

export async function markInvitationViewed(
  context: AwaitedAuthenticatedContext,
  invitationId: string,
) {
  return createAdminClient().from("request_matching_candidates")
    .update({
      invitation_status: "viewed",
      viewed_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("professional_id", context.profile.id)
    .in("invitation_status", ["sent", "delivered"])
    .select("id,invitation_status,viewed_at")
    .single();
}

export async function declineInvitation(
  context: AwaitedAuthenticatedContext,
  invitationId: string,
  reason: string,
) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("request_matching_candidates")
    .update({
      invitation_status: "declined",
      decline_reason: reason,
      responded_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("professional_id", context.profile.id)
    .in("invitation_status", ["sent", "delivered", "viewed"])
    .select("id,request_id,invitation_status")
    .single();
  if (!error && data) {
    await admin.from("domain_outbox").insert({
      event_type: "professional_invitation.declined",
      aggregate_type: "service_request",
      aggregate_id: data.request_id,
      payload: { invitationId, professionalId: context.profile.id },
    });
  }
  return { data, error };
}
