import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

import { proxyConfig as config } from "./lib/routing/proxy-config";

describe("request proxy matcher", () => {
  it("runs for localized application pages", () => {
    expect(
      unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/" }),
    ).toBe(true);
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "/ur/services",
      }),
    ).toBe(true);
  });

  it("does not intercept APIs or public image assets", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "/api/health",
      }),
    ).toBe(false);
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "/brand/fixmate-logo.png",
      }),
    ).toBe(false);
  });
});
