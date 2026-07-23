import { describe, expect, it } from "vitest";

import { operationalReviewSchema, riskReviewSchema } from "./schemas";

describe("operations review schemas", () => {
  it("requires a documented alert decision", () => {
    expect(
      operationalReviewSchema.safeParse({
        status: "resolved",
        note: "Verified and corrected.",
      }).success,
    ).toBe(true);
    expect(
      operationalReviewSchema.safeParse({ status: "resolved", note: "x" })
        .success,
    ).toBe(false);
  });

  it("rejects opaque automatic risk outcomes", () => {
    expect(
      riskReviewSchema.safeParse({
        status: "confirmed",
        note: "Evidence reviewed by an authorized staff member.",
      }).success,
    ).toBe(true);
    expect(
      riskReviewSchema.safeParse({ status: "banned", note: "automatic" })
        .success,
    ).toBe(false);
  });
});
