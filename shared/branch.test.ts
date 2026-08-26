import { describe, expect, it, vi } from "vitest";
import { createBranchPlan, nextBranchState, type LiveMarket } from "./branch.js";

const market: LiveMarket = {
  marketId: "0x01",
  asset: "BTC",
  intervalSec: 900,
  expiry: 2_000_000_000,
  venueId: "0x02",
  poolAddress: "0x03",
  onchainStatus: 1,
  verifiedAt: "2033-05-18T00:00:00.000Z",
};

describe("Branch planning", () => {
  it("binds the first leg and leaves future legs as selectors", () => {
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    const plan = createBranchPlan(
      { asset: "BTC", intervalSec: 900, budget: 90, maxEntryPrice: 0.72, path: ["DOWN", "UP", "UP"] },
      market,
    );

    expect(plan.legs).toHaveLength(3);
    expect(plan.legs[0].binding).toMatchObject({ kind: "market", marketId: "0x01", poolAddress: "0x03" });
    expect(plan.legs[1].binding).toEqual({ kind: "selector", asset: "BTC", intervalSec: 900 });
    expect(plan.legs[2].condition).toBe("Continue only if leg 2 settles UP");
  });

  it("rejects an indexed market that is not safely tradable on-chain", () => {
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    expect(() =>
      createBranchPlan(
        { asset: "BTC", intervalSec: 900, budget: 90, maxEntryPrice: 0.72, path: ["DOWN", "UP"] },
        { ...market, onchainStatus: 2 },
      ),
    ).toThrow("not safely tradable on-chain");
  });
});

describe("Branch resolution", () => {
  it("continues only when the settled outcome matches the path", () => {
    expect(nextBranchState("UP", "UP")).toBe("CONTINUE");
    expect(nextBranchState("UP", "DOWN")).toBe("TERMINATE");
    expect(nextBranchState("UP", "VOID")).toBe("TERMINATE");
  });
});
