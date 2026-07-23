import { describe, expect, it } from "vitest";

import { arrivalCodeSchema, locationPointSchema } from "./schemas";

describe("job command schemas", () => {
  it("accepts only six-digit arrival codes", () => {
    expect(arrivalCodeSchema.safeParse({ code: "004271" }).success).toBe(true);
    expect(arrivalCodeSchema.safeParse({ code: "4271" }).success).toBe(false);
    expect(arrivalCodeSchema.safeParse({ code: "abcdef" }).success).toBe(false);
  });

  it("rejects coordinates outside geographic bounds", () => {
    expect(locationPointSchema.safeParse({ latitude: 33.6844, longitude: 73.0479 }).success).toBe(true);
    expect(locationPointSchema.safeParse({ latitude: 91, longitude: 73 }).success).toBe(false);
  });
});
