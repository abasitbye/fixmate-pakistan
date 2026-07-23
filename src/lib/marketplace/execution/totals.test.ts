import { describe, expect, it } from "vitest";

import { calculateQuotationTotals } from "./totals";

describe("quotation totals", () => {
  it("uses integer minor units for itemized totals", () => {
    expect(calculateQuotationTotals([
      { itemType: "labor", description: "Labor", quantity: 2, unit: "hour", unitPriceMinor: 10_000 },
      { itemType: "material", description: "Part", quantity: 1, unit: "item", unitPriceMinor: 7_500, materialSource: "professional" },
      { itemType: "discount", description: "Discount", quantity: 1, unit: "offer", unitPriceMinor: 2_500 },
    ])).toEqual({ labor: 20_000, materials: 7_500, other: 0, discount: 2_500, total: 25_000 });
  });
});
