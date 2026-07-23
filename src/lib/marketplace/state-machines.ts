import type {
  BookingStatus,
  JobStatus,
  OfferStatus,
  RequestStatus,
} from "./contracts";

type TransitionMap<T extends string> = Readonly<Record<T, readonly T[]>>;

export const requestTransitions: TransitionMap<RequestStatus> = {
  draft: ["submitted", "cancelled"],
  submitted: ["matching", "cancelled", "expired"],
  matching: ["offers_received", "no_match", "cancelled", "expired"],
  offers_received: ["professional_selected", "matching", "cancelled", "expired"],
  professional_selected: ["converted_to_booking", "matching", "cancelled"],
  converted_to_booking: [],
  no_match: ["matching", "cancelled", "expired"],
  expired: ["matching", "cancelled"],
  cancelled: [],
};

export const offerTransitions: TransitionMap<OfferStatus> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["accepted", "rejected", "withdrawn", "expired", "superseded"],
  withdrawn: [],
  expired: [],
  accepted: [],
  rejected: [],
  superseded: [],
};

export const bookingTransitions: TransitionMap<BookingStatus> = {
  pending_confirmation: ["confirmed", "cancelled", "professional_no_show"],
  confirmed: ["reschedule_requested", "converted_to_job", "cancelled", "customer_no_show", "professional_no_show"],
  reschedule_requested: ["rescheduled", "confirmed", "cancelled"],
  rescheduled: ["confirmed", "converted_to_job", "cancelled", "customer_no_show", "professional_no_show"],
  cancelled: [],
  customer_no_show: [],
  professional_no_show: [],
  converted_to_job: ["completed"],
  completed: [],
};

export const jobTransitions: TransitionMap<JobStatus> = {
  created: ["confirmed", "cancelled"],
  confirmed: ["en_route", "cancelled", "disputed"],
  en_route: ["arrived", "cancelled", "disputed"],
  arrived: ["inspecting", "awaiting_quotation", "approved", "cancelled", "disputed"],
  inspecting: ["awaiting_quotation", "cancelled", "disputed"],
  awaiting_quotation: ["awaiting_approval", "cancelled", "disputed"],
  awaiting_approval: ["approved", "awaiting_quotation", "cancelled", "disputed"],
  approved: ["in_progress", "cancelled", "disputed"],
  in_progress: ["paused", "completion_submitted", "disputed"],
  paused: ["in_progress", "cancelled", "disputed"],
  completion_submitted: ["completed", "in_progress", "disputed"],
  completed: ["warranty_active", "closed", "disputed"],
  cancelled: ["disputed", "closed"],
  disputed: ["in_progress", "completed", "closed"],
  warranty_active: ["closed", "disputed"],
  closed: [],
};

export function canTransition<T extends string>(
  transitions: TransitionMap<T>,
  from: T,
  to: T,
) {
  return transitions[from].includes(to);
}

export function assertTransition<T extends string>(
  transitions: TransitionMap<T>,
  from: T,
  to: T,
  aggregate: string,
) {
  if (!canTransition(transitions, from, to)) {
    throw new MarketplaceTransitionError(aggregate, from, to);
  }
}

export class MarketplaceTransitionError extends Error {
  readonly code = "INVALID_STATE_TRANSITION";

  constructor(
    readonly aggregate: string,
    readonly from: string,
    readonly to: string,
  ) {
    super(`${aggregate} cannot transition from ${from} to ${to}.`);
  }
}
