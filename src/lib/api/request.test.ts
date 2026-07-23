import { describe, expect, it } from "vitest";

import { getSafeRedirect } from "./request";

describe("safe redirects", () => {
  it("allows only same-origin relative paths", () => {
    expect(getSafeRedirect("/customer")).toBe("/customer");
    expect(getSafeRedirect("//malicious.example")).toBe("/");
    expect(getSafeRedirect("https://malicious.example")).toBe("/");
  });
});
