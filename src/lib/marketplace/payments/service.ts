import "server-only";

import type { AwaitedAuthenticatedContext } from "@/lib/professional/types";
import { createAdminClient } from "@/lib/supabase/admin";

import { hashIdempotentRequest } from "../idempotency";

export function primaryRole(roles: string[]) {
  return roles.includes("super_admin")
    ? "super_admin"
    : roles.includes("admin")
      ? "admin"
      : roles.includes("support")
        ? "support"
        : roles.includes("professional")
          ? "professional"
          : "customer";
}

export async function getJobPayment(
  context: AwaitedAuthenticatedContext,
  jobId: string,
) {
  return context.supabase
    .from("payment_intents")
    .select(
      "id,payment_reference,job_id,customer_id,professional_id,provider,method_type,currency_code,amount_minor,platform_fee_minor,professional_amount_minor,status,provider_reference,expires_at,paid_at,version,created_at,payment_transactions(id,transaction_type,status,processed_at,metadata),refunds(id,refund_reference,amount_minor,reason,status,processed_at),transaction_documents(id,document_type,document_number,total_minor,wording,issued_at)",
    )
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function listPayments(context: AwaitedAuthenticatedContext) {
  return context.supabase
    .from("payment_intents")
    .select(
      "id,payment_reference,job_id,customer_id,professional_id,provider,method_type,currency_code,amount_minor,platform_fee_minor,professional_amount_minor,status,paid_at,created_at,jobs(job_reference)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
}

export async function listReceipts(context: AwaitedAuthenticatedContext) {
  return context.supabase
    .from("transaction_documents")
    .select(
      "id,job_id,payment_intent_id,document_type,document_number,currency_code,subtotal_minor,fees_minor,tax_minor,total_minor,wording,issued_at",
    )
    .eq("issued_to_user_id", context.profile.id)
    .order("issued_at", { ascending: false })
    .limit(200);
}

export async function createPaymentIntent(
  context: AwaitedAuthenticatedContext,
  jobId: string,
  methodType: "cash" | "manual_bank_transfer",
  paymentMethodId: string | null,
  key: string,
) {
  const provider = methodType === "cash" ? "cash" : "manual";
  const request = { jobId, provider, methodType, paymentMethodId };
  return createAdminClient().rpc("create_job_payment_intent", {
    p_actor_profile_id: context.profile.id,
    p_job_id: jobId,
    p_provider: provider,
    p_method_type: methodType,
    p_payment_method_id: paymentMethodId,
    p_idempotency_key: key,
    p_request_hash: hashIdempotentRequest(request),
  });
}

export async function reportManualPayment(
  context: AwaitedAuthenticatedContext,
  paymentId: string,
  note: string,
) {
  return createAdminClient().rpc("report_manual_payment", {
    p_actor_profile_id: context.profile.id,
    p_payment_intent_id: paymentId,
    p_note: note,
  });
}

export async function confirmManualPayment(
  context: AwaitedAuthenticatedContext,
  paymentId: string,
  key: string,
) {
  return createAdminClient().rpc("confirm_manual_payment", {
    p_actor_profile_id: context.profile.id,
    p_payment_intent_id: paymentId,
    p_idempotency_key: key,
    p_request_hash: hashIdempotentRequest({ paymentId }),
  });
}

export async function disputeManualPayment(
  context: AwaitedAuthenticatedContext,
  paymentId: string,
  reason: string,
) {
  return createAdminClient().rpc("open_payment_disagreement", {
    p_actor_profile_id: context.profile.id,
    p_payment_intent_id: paymentId,
    p_reason: reason,
  });
}

export async function requestRefund(
  context: AwaitedAuthenticatedContext,
  paymentId: string,
  amountMinor: number,
  reason: string,
  key: string,
) {
  return createAdminClient().rpc("request_payment_refund", {
    p_actor_profile_id: context.profile.id,
    p_payment_intent_id: paymentId,
    p_amount_minor: amountMinor,
    p_reason: reason,
    p_idempotency_key: key,
    p_request_hash: hashIdempotentRequest({ paymentId, amountMinor, reason }),
  });
}

export async function reconcilePayment(
  context: AwaitedAuthenticatedContext,
  caseId: string,
  confirmed: boolean,
  resolution: string,
  evidenceReference: string,
) {
  return createAdminClient().rpc("reconcile_manual_payment", {
    p_actor_profile_id: context.profile.id,
    p_actor_role: primaryRole(context.roles),
    p_case_id: caseId,
    p_resolution: resolution,
    p_confirmed: confirmed,
    p_evidence_reference: evidenceReference,
  });
}

export async function decideRefund(
  context: AwaitedAuthenticatedContext,
  refundId: string,
  approved: boolean,
  reason: string,
) {
  return createAdminClient().rpc("decide_payment_refund", {
    p_actor_profile_id: context.profile.id,
    p_actor_role: primaryRole(context.roles),
    p_refund_id: refundId,
    p_approved: approved,
    p_reason: reason,
  });
}

export async function completeRefund(
  context: AwaitedAuthenticatedContext,
  refundId: string,
  providerReference: string,
) {
  return createAdminClient().rpc("complete_manual_refund", {
    p_actor_profile_id: context.profile.id,
    p_actor_role: primaryRole(context.roles),
    p_refund_id: refundId,
    p_provider_reference: providerReference,
  });
}

export async function listEarnings(context: AwaitedAuthenticatedContext) {
  return context.supabase
    .from("professional_earnings")
    .select(
      "id,job_id,payment_intent_id,currency_code,gross_amount_minor,platform_fee_minor,adjustment_minor,net_amount_minor,requires_payout,status,available_at,held_reason,paid_at,created_at,jobs(job_reference)",
    )
    .eq("professional_id", context.profile.id)
    .order("created_at", { ascending: false })
    .limit(200);
}

export async function listPayouts(context: AwaitedAuthenticatedContext) {
  return context.supabase
    .from("professional_payouts")
    .select(
      "id,payout_reference,professional_id,provider,currency_code,amount_minor,status,provider_reference,scheduled_at,processed_at,failure_reason_safe,created_at,payout_earning_items(earning_id,amount_minor)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
}

export async function createPayout(
  context: AwaitedAuthenticatedContext,
  professionalId: string,
  earningIds: string[],
  key: string,
) {
  return createAdminClient().rpc("create_professional_payout", {
    p_actor_profile_id: context.profile.id,
    p_actor_role: primaryRole(context.roles),
    p_professional_id: professionalId,
    p_earning_ids: earningIds,
    p_idempotency_key: key,
    p_request_hash: hashIdempotentRequest({
      professionalId,
      earningIds: [...earningIds].sort(),
    }),
  });
}

export async function approvePayout(
  context: AwaitedAuthenticatedContext,
  payoutId: string,
) {
  return createAdminClient().rpc("approve_professional_payout", {
    p_actor_profile_id: context.profile.id,
    p_actor_role: primaryRole(context.roles),
    p_payout_id: payoutId,
  });
}

export async function recordPayoutPaid(
  context: AwaitedAuthenticatedContext,
  payoutId: string,
  providerReference: string,
  evidenceStoragePath: string,
) {
  return createAdminClient().rpc("record_professional_payout_paid", {
    p_actor_profile_id: context.profile.id,
    p_actor_role: primaryRole(context.roles),
    p_payout_id: payoutId,
    p_provider_reference: providerReference,
    p_evidence_storage_path: evidenceStoragePath,
  });
}
