import { describe, expect, it } from "vitest";

import { accountPurposeSchema, profileSchema, requestOtpSchema, verifyOtpSchema } from "./schemas";

describe("authentication input contracts", () => {
  it("normalizes a valid email and requires a security token", () => {
    expect(requestOtpSchema.parse({ email: "  USER@Example.COM ", turnstileToken: "verified-token" }).email).toBe("user@example.com");
    expect(requestOtpSchema.safeParse({ email: "not-an-email", turnstileToken: "" }).success).toBe(false);
  });

  it("accepts only numeric email OTP values", () => {
    expect(verifyOtpSchema.safeParse({ token: "123456" }).success).toBe(true);
    expect(verifyOtpSchema.safeParse({ token: "12A456" }).success).toBe(false);
  });

  it("requires explicit policy acceptance and a valid Pakistan-friendly phone format", () => {
    const base = { displayName: "Ayesha Khan", phone: "+92 300 1234567", preferredLocale: "en" };
    expect(profileSchema.safeParse({ ...base, acceptedPolicies: true }).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, acceptedPolicies: false }).success).toBe(false);
  });

  it("allows only supported account purposes", () => {
    expect(accountPurposeSchema.safeParse({ purpose: "professional" }).success).toBe(true);
    expect(accountPurposeSchema.safeParse({ purpose: "admin" }).success).toBe(false);
  });
});
