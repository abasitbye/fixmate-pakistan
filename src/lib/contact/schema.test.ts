import { describe, expect, it } from "vitest";

import { contactSchema } from "./schema";

describe("contact input contract", () => {
  it("accepts a bounded, verified contact message", () => {
    expect(contactSchema.safeParse({
      name: "Ali Khan", email: "ali@example.com", subject: "Account help",
      message: "I need help understanding my account status, please.", turnstileToken: "valid-token",
    }).success).toBe(true);
  });

  it("rejects short content and missing abuse verification", () => {
    expect(contactSchema.safeParse({ name: "A", email: "bad", subject: "Hi", message: "Help", turnstileToken: "" }).success).toBe(false);
  });
});
