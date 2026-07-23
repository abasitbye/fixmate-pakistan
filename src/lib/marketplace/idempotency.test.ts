import { describe, expect, it } from "vitest";

import {
  hashIdempotentRequest,
  IdempotencyKeyError,
  parseIdempotencyKey,
} from "./idempotency";

describe("marketplace idempotency", () => {
  it("creates the same hash for semantically identical objects", () => {
    expect(hashIdempotentRequest({ b: 2, a: 1 })).toBe(
      hashIdempotentRequest({ a: 1, b: 2 }),
    );
  });

  it("requires a sufficiently strong caller key", () => {
    const valid = new Request("https://fixmate.test", {
      headers: { "Idempotency-Key": "request:01JMARKETPLACE" },
    });
    expect(parseIdempotencyKey(valid)).toBe("request:01JMARKETPLACE");
    expect(() => parseIdempotencyKey(new Request("https://fixmate.test")))
      .toThrow(IdempotencyKeyError);
  });
});
