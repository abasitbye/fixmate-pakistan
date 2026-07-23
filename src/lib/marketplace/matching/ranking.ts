export type EligibilityInput = Readonly<{
  accountActive: boolean;
  profileApproved: boolean;
  verificationValid: boolean;
  serviceApproved: boolean;
  areaCovered: boolean;
  radiusAllowed: boolean;
  scheduleAvailable: boolean;
  hasConflict: boolean;
  suspended: boolean;
  blocked: boolean;
  riskAllowed: boolean;
}>;

export type RankingSignals = Readonly<{
  service: number;
  availability: number;
  quality: number;
  fairness: number;
}>;

export const defaultRankingWeights = {
  service: 0.4,
  availability: 0.25,
  quality: 0.15,
  fairness: 0.2,
} as const;

export function eligibilityReasons(input: EligibilityInput) {
  const reasons: string[] = [];
  if (!input.accountActive) reasons.push("account_inactive");
  if (!input.profileApproved) reasons.push("profile_not_approved");
  if (!input.verificationValid) reasons.push("verification_invalid");
  if (!input.serviceApproved) reasons.push("service_not_approved");
  if (!input.areaCovered) reasons.push("area_not_covered");
  if (!input.radiusAllowed) reasons.push("outside_travel_radius");
  if (!input.scheduleAvailable) reasons.push("schedule_unavailable");
  if (input.hasConflict) reasons.push("booking_conflict");
  if (input.suspended) reasons.push("professional_suspended");
  if (input.blocked) reasons.push("party_blocked");
  if (!input.riskAllowed) reasons.push("risk_rule");
  return reasons;
}

export function isEligible(input: EligibilityInput) {
  return eligibilityReasons(input).length === 0;
}

export function rankingScore(
  signals: RankingSignals,
  weights: typeof defaultRankingWeights = defaultRankingWeights,
) {
  for (const value of Object.values(signals)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new RangeError("Ranking signals must be between 0 and 100.");
    }
  }
  return Number((
    signals.service * weights.service +
    signals.availability * weights.availability +
    signals.quality * weights.quality +
    signals.fairness * weights.fairness
  ).toFixed(4));
}

export function workloadFairnessScore(activeJobCount: number) {
  if (!Number.isInteger(activeJobCount) || activeJobCount < 0) {
    throw new RangeError("Active job count must be a non-negative integer.");
  }
  return Math.max(20, 100 - activeJobCount * 10);
}
