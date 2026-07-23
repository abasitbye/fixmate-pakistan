import { apiError } from "@/lib/api/response";

const errors: Record<string, [number, string, string]> = {
  JOB_NOT_FOUND: [404, "JOB_NOT_FOUND", "The job was not found."],
  PAYMENT_NOT_FOUND: [404, "PAYMENT_NOT_FOUND", "The payment was not found."],
  PAYMENT_NOT_CREATABLE: [
    409,
    "PAYMENT_NOT_CREATABLE",
    "Payment is not due for this job.",
  ],
  COMPLETION_CONFIRMATION_REQUIRED: [
    409,
    "COMPLETION_CONFIRMATION_REQUIRED",
    "Confirm job completion before creating payment.",
  ],
  PAYMENT_ALREADY_CONFIRMED: [
    409,
    "PAYMENT_ALREADY_CONFIRMED",
    "This job has already been paid.",
  ],
  PAYMENT_METHOD_NOT_AVAILABLE: [
    400,
    "PAYMENT_METHOD_NOT_AVAILABLE",
    "The selected payment method is not available.",
  ],
  PAYMENT_NOT_REPORTABLE: [
    409,
    "PAYMENT_NOT_REPORTABLE",
    "This payment cannot be reported in its current state.",
  ],
  PAYMENT_NOT_CONFIRMABLE: [
    409,
    "PAYMENT_NOT_CONFIRMABLE",
    "The professional must report receipt before customer confirmation.",
  ],
  PAYMENT_NOT_DISPUTABLE: [
    409,
    "PAYMENT_NOT_DISPUTABLE",
    "This payment report cannot be disputed.",
  ],
  PAYMENT_DISAGREEMENT_REASON_REQUIRED: [
    400,
    "PAYMENT_DISAGREEMENT_REASON_REQUIRED",
    "Explain the payment disagreement.",
  ],
  ONLINE_PROVIDER_NOT_CONFIGURED: [
    503,
    "ONLINE_PROVIDER_NOT_CONFIGURED",
    "Online payment is not configured. Use cash or manual transfer.",
  ],
  INVALID_REFUND_REQUEST: [
    400,
    "INVALID_REFUND_REQUEST",
    "Check the refund amount and reason.",
  ],
  REFUND_NOT_AVAILABLE: [
    409,
    "REFUND_NOT_AVAILABLE",
    "This payment is not eligible for a refund request.",
  ],
  REFUND_EXCEEDS_PAYMENT: [
    409,
    "REFUND_EXCEEDS_PAYMENT",
    "The refund would exceed the confirmed payment.",
  ],
  REFUND_NOT_FOUND: [404, "REFUND_NOT_FOUND", "The refund was not found."],
  REFUND_NOT_DECIDABLE: [
    409,
    "REFUND_NOT_DECIDABLE",
    "This refund has already been decided.",
  ],
  REFUND_NOT_PROCESSABLE: [
    409,
    "REFUND_NOT_PROCESSABLE",
    "Approve the refund before recording settlement.",
  ],
  REFUND_EVIDENCE_REQUIRED: [
    400,
    "REFUND_EVIDENCE_REQUIRED",
    "A settlement reference is required.",
  ],
  RECONCILIATION_NOT_FOUND: [
    404,
    "RECONCILIATION_NOT_FOUND",
    "The reconciliation case was not found.",
  ],
  RECONCILIATION_ALREADY_RESOLVED: [
    409,
    "RECONCILIATION_ALREADY_RESOLVED",
    "This case has already been resolved.",
  ],
  RECONCILIATION_RESOLUTION_REQUIRED: [
    400,
    "RECONCILIATION_RESOLUTION_REQUIRED",
    "Document the reconciliation decision.",
  ],
  VERIFIED_PAYOUT_ACCOUNT_REQUIRED: [
    409,
    "VERIFIED_PAYOUT_ACCOUNT_REQUIRED",
    "The professional needs a verified payout account.",
  ],
  PAYOUT_EARNINGS_REQUIRED: [
    400,
    "PAYOUT_EARNINGS_REQUIRED",
    "Select at least one earning.",
  ],
  PAYOUT_EARNINGS_NOT_AVAILABLE: [
    409,
    "PAYOUT_EARNINGS_NOT_AVAILABLE",
    "One or more earnings are unavailable or already scheduled.",
  ],
  PAYOUT_NOT_FOUND: [404, "PAYOUT_NOT_FOUND", "The payout was not found."],
  PAYOUT_NOT_APPROVABLE: [
    409,
    "PAYOUT_NOT_APPROVABLE",
    "This payout cannot be approved.",
  ],
  PAYOUT_MAKER_CHECKER_REQUIRED: [
    403,
    "PAYOUT_MAKER_CHECKER_REQUIRED",
    "A different administrator must approve this payout.",
  ],
  PAYOUT_NOT_PAYABLE: [
    409,
    "PAYOUT_NOT_PAYABLE",
    "Approve the payout before recording settlement.",
  ],
  PAYOUT_EVIDENCE_REQUIRED: [
    400,
    "PAYOUT_EVIDENCE_REQUIRED",
    "A transfer reference and evidence file are required.",
  ],
  ADMIN_REQUIRED: [403, "ADMIN_REQUIRED", "Administrator access is required."],
  STAFF_REQUIRED: [403, "STAFF_REQUIRED", "Staff access is required."],
  IDEMPOTENCY_CONFLICT: [
    409,
    "IDEMPOTENCY_CONFLICT",
    "That action key was already used for different information.",
  ],
};

export function paymentCommandError(error: { message?: string } | null) {
  const match = Object.entries(errors).find(([marker]) =>
    error?.message?.includes(marker),
  );
  if (!match)
    return apiError(
      500,
      "PAYMENT_COMMAND_FAILED",
      "The financial action could not be completed.",
    );
  const [, [status, code, message]] = match;
  return apiError(status, code, message);
}
