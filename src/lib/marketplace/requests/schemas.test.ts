import { describe, expect, it } from "vitest";

import { requestDraftSchema, requestSubmitSchema } from "./schemas";

const validDraft = {
  propertyId: "10000000-0000-4000-8000-000000000001",
  serviceCategoryId: "10000000-0000-4000-8000-000000000002",
  serviceSubcategoryId: "10000000-0000-4000-8000-000000000003",
  title: "Kitchen sink is leaking",
  description: "Water is leaking below the kitchen sink when the tap is used.",
  urgency: "standard",
  pricingPreference: "estimated_range",
  preferredDate: "2026-07-30",
  preferredStartTime: "10:00",
  preferredEndTime: "12:00",
  flexibilityMinutes: 60,
};

describe("customer request schemas", () => {
  it("accepts a complete request draft", () => {
    expect(requestDraftSchema.safeParse(validDraft).success).toBe(true);
  });

  it("rejects inverted times and incomplete submit commands", () => {
    expect(requestDraftSchema.safeParse({
      ...validDraft,
      preferredStartTime: "14:00",
      preferredEndTime: "12:00",
    }).success).toBe(false);
    expect(requestSubmitSchema.safeParse({ version: 1, turnstileToken: "" }).success).toBe(false);
  });
});
