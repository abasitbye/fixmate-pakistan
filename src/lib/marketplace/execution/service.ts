import "server-only";

import type { AwaitedAuthenticatedContext } from "@/lib/professional/types";
import { createAdminClient } from "@/lib/supabase/admin";

import { hashIdempotentRequest } from "../idempotency";
import type { ChangeOrderDraftInput, QuotationDraftInput } from "./schemas";

export async function startInspection(context: AwaitedAuthenticatedContext, jobId: string, version: number) {
  return createAdminClient().rpc("start_job_inspection", {
    p_actor_profile_id: context.profile.id,
    p_job_id: jobId,
    p_expected_version: version,
  });
}

export async function completeInspection(
  context: AwaitedAuthenticatedContext,
  jobId: string,
  input: { inspectionId: string; version: number; findings: string; recommendedWork: string; safetyNotes: string },
) {
  return createAdminClient().rpc("complete_job_inspection", {
    p_actor_profile_id: context.profile.id,
    p_job_id: jobId,
    p_inspection_id: input.inspectionId,
    p_expected_version: input.version,
    p_findings: input.findings,
    p_recommended_work: input.recommendedWork,
    p_safety_notes: input.safetyNotes,
  });
}

export async function listJobQuotations(context: AwaitedAuthenticatedContext, jobId: string) {
  return context.supabase.from("job_quotations")
    .select("id,quotation_reference,job_id,professional_id,customer_id,version_number,currency_code,labor_subtotal_minor,materials_subtotal_minor,other_subtotal_minor,discount_minor,tax_minor,platform_fee_minor,total_minor,deposit_required_minor,estimated_duration_minutes,warranty_days,terms,exclusions,notes,valid_until,status,submitted_at,approved_at,rejected_at,version,created_at,job_quotation_items(id,item_type,description,quantity,unit,unit_price_minor,amount_minor,material_source,display_order),quotation_decisions(id,decision,reason,decided_at)")
    .eq("job_id", jobId)
    .order("version_number", { ascending: false });
}

export async function getQuotation(context: AwaitedAuthenticatedContext, quotationId: string) {
  return context.supabase.from("job_quotations")
    .select("id,quotation_reference,job_id,professional_id,customer_id,version_number,currency_code,labor_subtotal_minor,materials_subtotal_minor,other_subtotal_minor,discount_minor,tax_minor,platform_fee_minor,total_minor,deposit_required_minor,estimated_duration_minutes,warranty_days,terms,exclusions,notes,valid_until,status,submitted_at,approved_at,rejected_at,version,created_at,job_quotation_items(id,item_type,description,quantity,unit,unit_price_minor,amount_minor,material_source,display_order),quotation_decisions(id,decision,reason,decided_at),jobs(job_reference,status)")
    .eq("id", quotationId).single();
}

function quotationPayload(input: QuotationDraftInput) {
  return {
    deposit_required_minor: input.depositRequiredMinor,
    estimated_duration_minutes: input.estimatedDurationMinutes,
    warranty_days: input.warrantyDays,
    terms: input.terms,
    exclusions: input.exclusions,
    notes: input.notes,
    valid_until: input.validUntil,
    items: input.items.map((item, index) => ({
      item_type: item.itemType,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_minor: item.unitPriceMinor,
      material_source: item.materialSource ?? "",
      display_order: index,
    })),
  };
}

export async function saveQuotation(context: AwaitedAuthenticatedContext, jobId: string, input: QuotationDraftInput) {
  return createAdminClient().rpc("save_job_quotation", {
    p_actor_profile_id: context.profile.id,
    p_job_id: jobId,
    p_quotation_id: input.quotationId ?? null,
    p_expected_version: input.version,
    p_payload: quotationPayload(input),
  });
}

export async function submitQuotation(
  context: AwaitedAuthenticatedContext,
  quotationId: string,
  version: number,
  idempotencyKey: string,
) {
  return createAdminClient().rpc("submit_job_quotation", {
    p_actor_profile_id: context.profile.id,
    p_quotation_id: quotationId,
    p_expected_version: version,
    p_idempotency_key: idempotencyKey,
    p_request_hash: hashIdempotentRequest({ quotationId, version }),
  });
}

export async function decideQuotation(
  context: AwaitedAuthenticatedContext,
  quotationId: string,
  version: number,
  decision: "approved" | "rejected" | "revision_requested" | "clarification_requested",
  reason: string,
  idempotencyKey: string,
) {
  return createAdminClient().rpc("decide_job_quotation", {
    p_actor_profile_id: context.profile.id,
    p_quotation_id: quotationId,
    p_expected_version: version,
    p_decision: decision,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
    p_request_hash: hashIdempotentRequest({ quotationId, version, decision, reason }),
  });
}

export async function listJobChangeOrders(context: AwaitedAuthenticatedContext, jobId: string) {
  return context.supabase.from("job_change_orders")
    .select("id,change_order_reference,job_id,quotation_id,requested_by,reason,description,evidence_summary,currency_code,labor_change_minor,material_change_minor,other_change_minor,total_change_minor,schedule_change_minutes,emergency_safety_exception,emergency_justification,status,submitted_at,approved_at,rejected_at,version,created_at")
    .eq("job_id", jobId).order("created_at", { ascending: false });
}

function changeOrderPayload(input: ChangeOrderDraftInput) {
  return {
    reason: input.reason,
    description: input.description,
    evidence_summary: input.evidenceSummary,
    labor_change_minor: input.laborChangeMinor,
    material_change_minor: input.materialChangeMinor,
    other_change_minor: input.otherChangeMinor,
    schedule_change_minutes: input.scheduleChangeMinutes,
    emergency_safety_exception: input.emergencySafetyException,
    emergency_justification: input.emergencyJustification,
  };
}

export async function saveChangeOrder(context: AwaitedAuthenticatedContext, jobId: string, input: ChangeOrderDraftInput) {
  return createAdminClient().rpc("save_job_change_order", {
    p_actor_profile_id: context.profile.id,
    p_job_id: jobId,
    p_change_order_id: input.changeOrderId ?? null,
    p_expected_version: input.version,
    p_payload: changeOrderPayload(input),
  });
}

export async function submitChangeOrder(context: AwaitedAuthenticatedContext, changeOrderId: string, version: number) {
  return createAdminClient().rpc("submit_job_change_order", {
    p_actor_profile_id: context.profile.id,
    p_change_order_id: changeOrderId,
    p_expected_version: version,
  });
}

export async function decideChangeOrder(
  context: AwaitedAuthenticatedContext,
  changeOrderId: string,
  decision: "approved" | "rejected",
  reason: string,
) {
  return createAdminClient().rpc("decide_job_change_order", {
    p_actor_profile_id: context.profile.id,
    p_change_order_id: changeOrderId,
    p_decision: decision,
    p_reason: reason,
  });
}

export async function withdrawChangeOrder(context: AwaitedAuthenticatedContext, changeOrderId: string, version: number) {
  return createAdminClient().rpc("withdraw_job_change_order", {
    p_actor_profile_id: context.profile.id,
    p_change_order_id: changeOrderId,
    p_expected_version: version,
  });
}

export async function listJobMessages(context: AwaitedAuthenticatedContext, jobId: string) {
  return context.supabase.from("job_messages")
    .select("id,job_id,sender_user_id,message_type,body,reply_to_message_id,sent_at,moderation_status,metadata,job_message_reads(user_id,read_at),job_message_attachments(id,job_media_id,mime_type,file_size)")
    .eq("job_id", jobId).is("deleted_at", null).order("sent_at", { ascending: true }).limit(200);
}

export async function sendJobMessage(
  context: AwaitedAuthenticatedContext,
  jobId: string,
  body: string,
  replyToMessageId?: string,
) {
  const role = context.roles.includes("super_admin") ? "super_admin"
    : context.roles.includes("admin") ? "admin"
      : context.roles.includes("support") ? "support"
        : context.roles.includes("professional") ? "professional" : "customer";
  return createAdminClient().rpc("send_job_message", {
    p_actor_profile_id: context.profile.id,
    p_actor_role: role,
    p_job_id: jobId,
    p_body: body,
    p_reply_to_message_id: replyToMessageId ?? null,
  });
}

export async function markJobMessageRead(context: AwaitedAuthenticatedContext, jobId: string, messageId: string) {
  return createAdminClient().rpc("mark_job_message_read", {
    p_actor_profile_id: context.profile.id,
    p_job_id: jobId,
    p_message_id: messageId,
  });
}

export async function startWork(context: AwaitedAuthenticatedContext, jobId: string, version: number) {
  return createAdminClient().rpc("start_job_work", { p_actor_profile_id: context.profile.id, p_job_id: jobId, p_expected_version: version });
}
export async function pauseWork(context: AwaitedAuthenticatedContext, jobId: string, version: number, reason: string) {
  return createAdminClient().rpc("pause_job_work", { p_actor_profile_id: context.profile.id, p_job_id: jobId, p_expected_version: version, p_reason: reason });
}
export async function resumeWork(context: AwaitedAuthenticatedContext, jobId: string, version: number) {
  return createAdminClient().rpc("resume_job_work", { p_actor_profile_id: context.profile.id, p_job_id: jobId, p_expected_version: version });
}
export async function submitCompletion(context: AwaitedAuthenticatedContext, jobId: string, version: number, summary: string, outstandingNotes: string) {
  return createAdminClient().rpc("submit_job_completion", {
    p_actor_profile_id: context.profile.id, p_job_id: jobId, p_expected_version: version,
    p_summary: summary, p_outstanding_notes: outstandingNotes,
  });
}
export async function decideCompletion(
  context: AwaitedAuthenticatedContext,
  jobId: string,
  decision: "confirmed" | "issue_reported",
  notes: string,
  idempotencyKey: string,
) {
  return createAdminClient().rpc("decide_job_completion", {
    p_actor_profile_id: context.profile.id, p_job_id: jobId, p_decision: decision, p_notes: notes,
    p_idempotency_key: idempotencyKey,
    p_request_hash: hashIdempotentRequest({ jobId, decision, notes }),
  });
}
