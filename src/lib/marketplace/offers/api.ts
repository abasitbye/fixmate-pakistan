import { apiError } from "@/lib/api/response";

const errors: Record<string, [number, string, string]> = {
  REQUEST_NOT_OFFERABLE: [409, "REQUEST_NOT_OFFERABLE", "This request is not accepting offers."],
  INVITATION_NOT_AVAILABLE: [403, "INVITATION_NOT_AVAILABLE", "This invitation is unavailable or expired."],
  PROFESSIONAL_NOT_ELIGIBLE: [403, "PROFESSIONAL_NOT_ELIGIBLE", "Professional marketplace access is unavailable."],
  INVALID_OFFER_TOTAL: [400, "INVALID_OFFER_TOTAL", "Check the offer total."],
  INVALID_OFFER_RANGE: [400, "INVALID_OFFER_RANGE", "Check the estimated price range."],
  OFFER_NOT_FOUND: [404, "OFFER_NOT_FOUND", "The offer was not found."],
  OFFER_NOT_EDITABLE: [409, "OFFER_NOT_EDITABLE", "This offer can no longer be edited."],
  OFFER_NOT_SUBMITTABLE: [409, "OFFER_NOT_SUBMITTABLE", "This offer cannot be submitted."],
  OFFER_NOT_WITHDRAWABLE: [409, "OFFER_NOT_WITHDRAWABLE", "This offer cannot be withdrawn."],
  OFFER_SCHEDULE_EXPIRED: [400, "OFFER_SCHEDULE_EXPIRED", "Choose a future schedule and validity period."],
  OFFER_ALREADY_SELECTED: [409, "OFFER_ALREADY_SELECTED", "An offer has already been selected."],
  OFFER_NOT_ACCEPTABLE: [409, "OFFER_NOT_ACCEPTABLE", "This offer is no longer available."],
  PROFESSIONAL_SCHEDULE_CONFLICT: [409, "PROFESSIONAL_SCHEDULE_CONFLICT", "The professional is no longer available at that time."],
  VERSION_CONFLICT: [409, "VERSION_CONFLICT", "This record changed in another session. Refresh and try again."],
  IDEMPOTENCY_CONFLICT: [409, "IDEMPOTENCY_CONFLICT", "That action key was used for different information."],
};

export function offerCommandError(error: { message?: string } | null) {
  const match = Object.entries(errors).find(([marker]) => error?.message?.includes(marker));
  if (!match) return apiError(500, "OFFER_COMMAND_FAILED", "The offer action could not be completed.");
  const [, [status, code, message]] = match;
  return apiError(status, code, message);
}
