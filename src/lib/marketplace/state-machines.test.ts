import { describe, expect, it } from "vitest";

import {
  assertTransition,
  bookingTransitions,
  canTransition,
  jobTransitions,
  MarketplaceTransitionError,
  offerTransitions,
  requestTransitions,
} from "./state-machines";

describe("marketplace state machines", () => {
  it("allows valid request, offer, booking, and job progress", () => {
    expect(canTransition(requestTransitions, "draft", "submitted")).toBe(true);
    expect(canTransition(offerTransitions, "submitted", "accepted")).toBe(true);
    expect(canTransition(bookingTransitions, "confirmed", "converted_to_job")).toBe(true);
    expect(canTransition(jobTransitions, "approved", "in_progress")).toBe(true);
  });

  it("blocks work before approval and terminal reopening", () => {
    expect(canTransition(jobTransitions, "awaiting_approval", "in_progress")).toBe(false);
    expect(canTransition(offerTransitions, "accepted", "submitted")).toBe(false);
    expect(() => assertTransition(requestTransitions, "cancelled", "matching", "request"))
      .toThrow(MarketplaceTransitionError);
  });
});
