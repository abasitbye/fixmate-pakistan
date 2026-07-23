import { apiError } from "@/lib/api/response";

const errors: Record<string, [number, string, string]> = {
  JOB_NOT_FOUND: [404, "JOB_NOT_FOUND", "The job was not found."],
  JOB_NOT_READY_FOR_TRAVEL: [409, "JOB_NOT_READY_FOR_TRAVEL", "This job is not ready to mark en route."],
  EN_ROUTE_TOO_EARLY: [409, "EN_ROUTE_TOO_EARLY", "You can mark en route only within the configured travel window."],
  ARRIVAL_CODE_NOT_AVAILABLE: [409, "ARRIVAL_CODE_NOT_AVAILABLE", "An arrival code is not available for this job."],
  ARRIVAL_NOT_VERIFIABLE: [409, "ARRIVAL_NOT_VERIFIABLE", "Arrival cannot be verified in the current job state."],
  ARRIVAL_CODE_NOT_FOUND: [404, "ARRIVAL_CODE_NOT_FOUND", "Ask the customer to generate a new arrival code."],
  LOCATION_CONSENT_REQUIRED: [400, "LOCATION_CONSENT_REQUIRED", "Explicit location-sharing consent is required."],
  LOCATION_SHARING_NOT_AVAILABLE: [409, "LOCATION_SHARING_NOT_AVAILABLE", "Location sharing is available only while en route."],
  LOCATION_SESSION_NOT_FOUND: [404, "LOCATION_SESSION_NOT_FOUND", "No active location-sharing session was found."],
  VERSION_CONFLICT: [409, "VERSION_CONFLICT", "This job changed in another session. Refresh and try again."],
};

export function jobCommandError(error: { message?: string } | null) {
  const match = Object.entries(errors).find(([marker]) => error?.message?.includes(marker));
  if (!match) return apiError(500, "JOB_COMMAND_FAILED", "The job action could not be completed.");
  const [, [status, code, message]] = match;
  return apiError(status, code, message);
}
