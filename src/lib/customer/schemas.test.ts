import { describe, expect, it } from "vitest";

import { propertySchema, updatePropertySchema } from "./schemas";

const validProperty = {
  label: "Home",
  propertyType: "house",
  addressLine1: "House 10, Street 5",
  cityId: "f3b08c44-34f9-4cc5-b94a-96d902f3db32",
  isDefault: true,
};

describe("property input contracts", () => {
  it("accepts a complete owned-property payload", () => {
    expect(propertySchema.safeParse(validProperty).success).toBe(true);
  });

  it("rejects unknown property types and empty updates", () => {
    expect(propertySchema.safeParse({ ...validProperty, propertyType: "warehouse" }).success).toBe(false);
    expect(updatePropertySchema.safeParse({}).success).toBe(false);
  });
});
