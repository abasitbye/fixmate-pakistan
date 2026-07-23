import { describe, expect, it } from "vitest";

import {
  addMinorAmounts,
  calculateBasisPointFee,
  createMoney,
} from "./money";

describe("marketplace money", () => {
  it("calculates configurable fees using integer minor units", () => {
    expect(calculateBasisPointFee(10_000, 1_000)).toBe(1_000);
    expect(calculateBasisPointFee(10_000, 500, 100, 700)).toBe(700);
    expect(calculateBasisPointFee(100_000, 1_000, 0, undefined, 5_000)).toBe(5_000);
  });

  it("rejects unsafe or negative money", () => {
    expect(addMinorAmounts(100, 250, 650)).toBe(1_000);
    expect(createMoney(500)).toEqual({ amountMinor: 500, currencyCode: "PKR" });
    expect(() => createMoney(-1)).toThrow(RangeError);
    expect(() => addMinorAmounts(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
  });
});
