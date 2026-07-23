import { describe, expect, it } from "vitest";

import { getPaymentProvider, OnlineProviderUnavailableError } from "./provider";

describe("payment provider boundary", () => {
  it("exposes manual settlement without claiming online support", async () => {
    const provider = getPaymentProvider("manual");
    expect(provider?.supportsOnlinePayment).toBe(false);
    await expect(
      provider?.createPayment(
        {
          paymentIntentId: crypto.randomUUID(),
          paymentReference: "FMP-TEST",
          amountMinor: 10_000,
          currencyCode: "PKR",
          returnUrl: "https://example.test/return",
        },
        "test-idempotency-key",
      ),
    ).rejects.toBeInstanceOf(OnlineProviderUnavailableError);
  });

  it("does not manufacture an adapter for an unconfigured gateway", () => {
    expect(getPaymentProvider("raast")).toBeNull();
    expect(getPaymentProvider("mobile_wallet")).toBeNull();
  });
});
