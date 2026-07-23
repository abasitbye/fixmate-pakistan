import { describe, expect, it } from "vitest";

import {
  eligibilityReasons,
  isEligible,
  rankingScore,
  workloadFairnessScore,
} from "./ranking";

const eligible = {
  accountActive: true,
  profileApproved: true,
  verificationValid: true,
  serviceApproved: true,
  areaCovered: true,
  radiusAllowed: true,
  scheduleAvailable: true,
  hasConflict: false,
  suspended: false,
  blocked: false,
  riskAllowed: true,
};

describe("matching ranking", () => {
  it("enforces every hard eligibility filter", () => {
    expect(isEligible(eligible)).toBe(true);
    expect(eligibilityReasons({ ...eligible, verificationValid: false, hasConflict: true }))
      .toEqual(["verification_invalid", "booking_conflict"]);
  });

  it("uses deterministic weighted ranking with workload fairness", () => {
    expect(workloadFairnessScore(0)).toBe(100);
    expect(workloadFairnessScore(12)).toBe(20);
    expect(rankingScore({ service: 100, availability: 100, quality: 50, fairness: 100 }))
      .toBe(92.5);
  });
});
