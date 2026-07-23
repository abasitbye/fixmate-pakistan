import { describe, expect, it } from "vitest";

import { offerDraftSchema } from "./schemas";
import { calculateOfferTotals } from "./totals";

describe("professional offer totals", () => {
  it("uses integer minor units and the greater declared breakdown", () => {
    const offer = offerDraftSchema.parse({
      offerType: "fixed_price",
      calloutFeeMinor: 10_000,
      laborAmountMinor: 50_000,
      materialEstimateMinor: 20_000,
      inspectionFeeMinor: 0,
      message: "Includes labor and the listed replacement component.",
      estimatedDurationMinutes: 120,
      proposedStartAt: "2026-08-01T05:00:00.000Z",
      proposedEndAt: "2026-08-01T07:00:00.000Z",
      includesMaterials: true,
      warrantyDays: 30,
      validUntil: "2030-08-01T00:00:00.000Z",
      items: [{ itemType: "labor", description: "Repair labor", quantity: 2, unit: "hour", unitPriceMinor: 30_000 }],
    });
    expect(calculateOfferTotals(offer)).toEqual({
      itemTotalMinor: 60_000,
      componentTotalMinor: 80_000,
      totalAmountMinor: 80_000,
    });
  });
});
