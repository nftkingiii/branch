import { describe, expect, it } from "vitest";
import { shouldUseSpaFallback, staticCacheControl } from "./static-policy.js";

describe("static release policy", () => {
  it("never serves the SPA HTML for a missing hashed asset", () => {
    expect(shouldUseSpaFallback("/assets/wallet-old.js")).toBe(false);
    expect(shouldUseSpaFallback("/positions")).toBe(true);
  });

  it("keeps HTML fresh and hashed assets immutable", () => {
    expect(staticCacheControl("/index.html")).toBe("no-store");
    expect(staticCacheControl("/assets/wallet-current.js")).toContain("immutable");
  });
});
