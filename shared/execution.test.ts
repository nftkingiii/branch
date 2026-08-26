import { describe, expect, it } from "vitest";
import { alignExecutionIntent, createExecutionIntent } from "./execution.js";
import type { BranchPlan } from "./branch.js";

const plan = (outcome: "UP" | "DOWN"): BranchPlan => ({
  asset: "BTC",
  intervalSec: 900,
  budget: 30,
  maxEntryPrice: 0.6,
  stopRule: "stop",
  legs: [{
    index: 0,
    expected: outcome,
    allocation: 10,
    condition: "Start",
    binding: {
      kind: "market",
      marketId: `0x${"1".repeat(64)}`,
      venueId: `0x${"2".repeat(64)}`,
      poolAddress: `0x${"3".repeat(40)}`,
      expiry: 2_000_000_000,
    },
  }],
});

describe("createExecutionIntent", () => {
  it("maps an UP cap into YES terms", () => {
    const intent = createExecutionIntent(plan("UP"));
    expect(intent.side).toBe("BUY_YES");
    expect(intent.yesLimitPrice).toBe(600_000n);
    expect(intent.quantity).toBe(16_666_666n);
  });

  it("inverts a DOWN cap into the pool's YES price", () => {
    const intent = createExecutionIntent(plan("DOWN"));
    expect(intent.side).toBe("BUY_NO");
    expect(intent.yesLimitPrice).toBe(400_000n);
    expect(intent.selectedOutcomePrice).toBe(600_000n);
  });

  it("rounds UP down and DOWN up in YES terms without breaching the selected cap", () => {
    const up = alignExecutionIntent(createExecutionIntent(plan("UP")), { tickSize: 7_000n, lotSize: 10_000n, minQuantity: 10_000n });
    const down = alignExecutionIntent(createExecutionIntent(plan("DOWN")), { tickSize: 7_000n, lotSize: 10_000n, minQuantity: 10_000n });
    expect(up.yesLimitPrice).toBe(595_000n);
    expect(down.yesLimitPrice).toBe(406_000n);
    expect(up.quantity).toBe(16_660_000n);
  });
});
