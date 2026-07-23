import { apiError } from "@/lib/api/response";

const errors: Record<string, [number, string, string]> = {
  BOOKING_NOT_FOUND: [404, "BOOKING_NOT_FOUND", "The booking was not found."],
  BOOKING_FORBIDDEN: [403, "BOOKING_FORBIDDEN", "You do not have access to this booking."],
  BOOKING_NOT_CONFIRMABLE: [409, "BOOKING_NOT_CONFIRMABLE", "This booking can no longer be confirmed."],
  BOOKING_CONFIRMATION_EXPIRED: [409, "BOOKING_CONFIRMATION_EXPIRED", "The confirmation window has expired."],
  BOOKING_SCHEDULE_EXPIRED: [409, "BOOKING_SCHEDULE_EXPIRED", "The booking schedule has expired."],
  BOOKING_NOT_RESCHEDULABLE: [409, "BOOKING_NOT_RESCHEDULABLE", "This booking cannot be rescheduled."],
  RESCHEDULE_NOT_FOUND: [404, "RESCHEDULE_NOT_FOUND", "The reschedule request was not found."],
  RESCHEDULE_EXPIRED: [409, "RESCHEDULE_EXPIRED", "The reschedule response window has expired."],
  RESCHEDULE_RESPONSE_FORBIDDEN: [403, "RESCHEDULE_RESPONSE_FORBIDDEN", "Only the other booking participant can respond."],
  PROFESSIONAL_SCHEDULE_CONFLICT: [409, "PROFESSIONAL_SCHEDULE_CONFLICT", "The professional is not available at that time."],
  BOOKING_NOT_CANCELLABLE: [409, "BOOKING_NOT_CANCELLABLE", "This booking can no longer be cancelled."],
  CANCELLATION_POLICY_ACKNOWLEDGEMENT_REQUIRED: [409, "CANCELLATION_POLICY_ACKNOWLEDGEMENT_REQUIRED", "Review and acknowledge the cancellation fee before continuing."],
  NO_SHOW_NOT_RECORDABLE: [409, "NO_SHOW_NOT_RECORDABLE", "A no-show cannot be recorded for this booking."],
  NO_SHOW_EVIDENCE_REQUIRED: [400, "NO_SHOW_EVIDENCE_REQUIRED", "Add an evidence or support-case reference for a unilateral no-show outcome."],
  INVALID_NO_SHOW_PARTY: [400, "INVALID_NO_SHOW_PARTY", "Choose a valid attendance outcome."],
  VERSION_CONFLICT: [409, "VERSION_CONFLICT", "This booking changed in another session. Refresh and try again."],
  IDEMPOTENCY_CONFLICT: [409, "IDEMPOTENCY_CONFLICT", "That action key was used for different information."],
};

export function bookingCommandError(error: { message?: string } | null) {
  const match = Object.entries(errors).find(([marker]) => error?.message?.includes(marker));
  if (!match) return apiError(500, "BOOKING_COMMAND_FAILED", "The booking action could not be completed.");
  const [, [status, code, message]] = match;
  return apiError(status, code, message);
}
