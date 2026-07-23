import { describe, expect, it } from "vitest";

import { redactSensitiveData } from "./sanitize";

describe("redactSensitiveData", () => {
  it("redacts security, identity, address, and financial fields recursively", () => {
    expect(
      redactSensitiveData({
        email: "person@example.com",
        otp: "123456",
        profile: {
          full_name: "Customer",
          home_address: "Sensitive address",
          wallet: { account: "Sensitive wallet" },
        },
        headers: { authorization: "Bearer secret" },
      }),
    ).toEqual({
      email: "person@example.com",
      otp: "[REDACTED]",
      profile: {
        full_name: "Customer",
        home_address: "[REDACTED]",
        wallet: "[REDACTED]",
      },
      headers: { authorization: "[REDACTED]" },
    });
  });

  it("handles arrays and null values without changing safe data", () => {
    expect(redactSensitiveData([null, { status: "approved" }])).toEqual([
      null,
      { status: "approved" },
    ]);
  });
});

