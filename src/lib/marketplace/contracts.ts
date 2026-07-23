export const requestStatuses = [
  "draft",
  "submitted",
  "matching",
  "offers_received",
  "professional_selected",
  "converted_to_booking",
  "no_match",
  "expired",
  "cancelled",
] as const;

export const offerStatuses = [
  "draft",
  "submitted",
  "withdrawn",
  "expired",
  "accepted",
  "rejected",
  "superseded",
] as const;

export const bookingStatuses = [
  "pending_confirmation",
  "confirmed",
  "reschedule_requested",
  "rescheduled",
  "cancelled",
  "customer_no_show",
  "professional_no_show",
  "converted_to_job",
  "completed",
] as const;

export const jobStatuses = [
  "created",
  "confirmed",
  "en_route",
  "arrived",
  "inspecting",
  "awaiting_quotation",
  "awaiting_approval",
  "approved",
  "in_progress",
  "paused",
  "completion_submitted",
  "completed",
  "cancelled",
  "disputed",
  "warranty_active",
  "closed",
] as const;

export type RequestStatus = (typeof requestStatuses)[number];
export type OfferStatus = (typeof offerStatuses)[number];
export type BookingStatus = (typeof bookingStatuses)[number];
export type JobStatus = (typeof jobStatuses)[number];

export type Money = Readonly<{
  amountMinor: number;
  currencyCode: "PKR" | (string & {});
}>;

export type MarketplaceActor = Readonly<{
  authUserId: string;
  profileId: string;
  roles: readonly string[];
}>;

export type DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> = Readonly<{
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
}>;

export type PageRequest = Readonly<{
  cursor?: string;
  limit: number;
}>;

export type PageResult<T> = Readonly<{
  items: T[];
  nextCursor: string | null;
}>;
