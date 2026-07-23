import { apiError } from "@/lib/api/response";

const safeErrors: Record<string, [number, string, string]> = {
  ACCOUNT_NOT_ACTIVE: [403, "ACCOUNT_RESTRICTED", "This account cannot create marketplace requests."],
  PROPERTY_NOT_AVAILABLE: [400, "PROPERTY_NOT_AVAILABLE", "Choose one of your active properties."],
  SERVICE_NOT_AVAILABLE: [400, "SERVICE_NOT_AVAILABLE", "Choose an available service."],
  ZONE_NOT_AVAILABLE: [400, "ZONE_NOT_AVAILABLE", "Service is not currently available for this property zone."],
  REQUEST_NOT_AVAILABLE: [404, "REQUEST_NOT_FOUND", "The service request was not found."],
  REQUEST_NOT_EDITABLE: [409, "REQUEST_NOT_EDITABLE", "This request can no longer be edited."],
  REQUEST_NOT_SUBMITTABLE: [409, "REQUEST_NOT_SUBMITTABLE", "This request cannot be submitted in its current state."],
  REQUEST_NOT_CANCELLABLE: [409, "REQUEST_NOT_CANCELLABLE", "This request can no longer be cancelled here."],
  REQUEST_SCHEDULE_REQUIRED: [400, "REQUEST_SCHEDULE_REQUIRED", "Choose a preferred service date and start time."],
  CANCELLATION_REASON_REQUIRED: [400, "CANCELLATION_REASON_REQUIRED", "Provide a cancellation reason."],
  VERSION_CONFLICT: [409, "VERSION_CONFLICT", "This request changed in another session. Refresh and try again."],
  IDEMPOTENCY_CONFLICT: [409, "IDEMPOTENCY_CONFLICT", "That action key was already used for different information."],
};

export function requestCommandError(error: { message?: string } | null) {
  const match = Object.entries(safeErrors).find(([marker]) =>
    error?.message?.includes(marker),
  );
  if (!match) return apiError(500, "REQUEST_COMMAND_FAILED", "The request action could not be completed.");
  const [, [status, code, message]] = match;
  return apiError(status, code, message);
}
