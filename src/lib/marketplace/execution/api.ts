import { apiError } from "@/lib/api/response";

const errors: Record<string, [number, string, string]> = {
  JOB_NOT_FOUND: [404, "JOB_NOT_FOUND", "The job was not found."],
  INSPECTION_NOT_STARTABLE: [409, "INSPECTION_NOT_STARTABLE", "Inspection cannot start in the current job state."],
  INSPECTION_NOT_COMPLETABLE: [409, "INSPECTION_NOT_COMPLETABLE", "This inspection cannot be completed."],
  INSPECTION_DETAILS_REQUIRED: [400, "INSPECTION_DETAILS_REQUIRED", "Add detailed findings and recommended work."],
  QUOTATION_NOT_FOUND: [404, "QUOTATION_NOT_FOUND", "The quotation was not found."],
  QUOTATION_NOT_EDITABLE: [409, "QUOTATION_NOT_EDITABLE", "Submitted quotations are immutable. Create a new version."],
  QUOTATION_NOT_SUBMITTABLE: [409, "QUOTATION_NOT_SUBMITTABLE", "This quotation cannot be submitted."],
  QUOTATION_NOT_DECIDABLE: [409, "QUOTATION_NOT_DECIDABLE", "This quotation is not awaiting a customer decision."],
  QUOTATION_ITEMS_REQUIRED: [400, "QUOTATION_ITEMS_REQUIRED", "Add at least one quotation item."],
  INVALID_QUOTATION_ITEM: [400, "INVALID_QUOTATION_ITEM", "Check the quotation line items."],
  INVALID_QUOTATION_TOTAL: [400, "INVALID_QUOTATION_TOTAL", "The quotation total must be greater than zero."],
  INVALID_QUOTATION_DEPOSIT: [400, "INVALID_QUOTATION_DEPOSIT", "The deposit cannot exceed the quotation total."],
  QUOTATION_VALIDITY_REQUIRED: [400, "QUOTATION_VALIDITY_REQUIRED", "Choose a future quotation expiry."],
  QUOTATION_EXPIRED: [410, "QUOTATION_EXPIRED", "This quotation expired. Ask for a new version."],
  DECISION_REASON_REQUIRED: [400, "DECISION_REASON_REQUIRED", "Add a reason for this decision."],
  APPROVED_QUOTATION_REQUIRED: [409, "APPROVED_QUOTATION_REQUIRED", "An approved quotation is required."],
  CHANGE_ORDER_NOT_FOUND: [404, "CHANGE_ORDER_NOT_FOUND", "The change order was not found."],
  CHANGE_ORDER_NOT_EDITABLE: [409, "CHANGE_ORDER_NOT_EDITABLE", "This change order cannot be edited."],
  CHANGE_ORDER_NOT_SUBMITTABLE: [409, "CHANGE_ORDER_NOT_SUBMITTABLE", "This change order cannot be submitted."],
  CHANGE_ORDER_NOT_DECIDABLE: [409, "CHANGE_ORDER_NOT_DECIDABLE", "This change order is not awaiting a decision."],
  CHANGE_ORDER_APPROVAL_PENDING: [409, "CHANGE_ORDER_APPROVAL_PENDING", "Resolve the pending change order before continuing."],
  WORK_NOT_STARTABLE: [409, "WORK_NOT_STARTABLE", "Work cannot start before explicit quotation approval."],
  WORK_NOT_PAUSABLE: [409, "WORK_NOT_PAUSABLE", "This job is not currently in progress."],
  WORK_NOT_RESUMABLE: [409, "WORK_NOT_RESUMABLE", "This job cannot be resumed yet."],
  PAUSE_REASON_REQUIRED: [400, "PAUSE_REASON_REQUIRED", "Choose or document a pause reason."],
  COMPLETION_NOT_SUBMITTABLE: [409, "COMPLETION_NOT_SUBMITTABLE", "Completion cannot be submitted in the current state."],
  COMPLETION_NOT_DECIDABLE: [409, "COMPLETION_NOT_DECIDABLE", "Completion is not awaiting a customer decision."],
  COMPLETION_SUMMARY_REQUIRED: [400, "COMPLETION_SUMMARY_REQUIRED", "Add a clear completion summary."],
  COMPLETION_ISSUE_DETAILS_REQUIRED: [400, "COMPLETION_ISSUE_DETAILS_REQUIRED", "Describe the incomplete or damaged work."],
  FINAL_EVIDENCE_REQUIRED: [409, "FINAL_EVIDENCE_REQUIRED", "Upload final after-work evidence before submitting completion."],
  JOB_MESSAGE_FORBIDDEN: [403, "JOB_MESSAGE_FORBIDDEN", "You cannot access this job conversation."],
  INVALID_MESSAGE: [400, "INVALID_MESSAGE", "Enter a plain-text message up to 4,000 characters."],
  VERSION_CONFLICT: [409, "VERSION_CONFLICT", "This record changed in another session. Refresh and try again."],
  IDEMPOTENCY_CONFLICT: [409, "IDEMPOTENCY_CONFLICT", "That action key was already used for different information."],
};

export function executionCommandError(error: { message?: string } | null) {
  const match = Object.entries(errors).find(([marker]) => error?.message?.includes(marker));
  if (!match) return apiError(500, "JOB_EXECUTION_COMMAND_FAILED", "The job action could not be completed.");
  const [, [status, code, message]] = match;
  return apiError(status, code, message);
}
