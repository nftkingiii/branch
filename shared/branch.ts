import { z } from "zod";

export const outcomeSchema = z.enum(["UP", "DOWN"]);
export type Outcome = z.infer<typeof outcomeSchema>;

export const planInputSchema = z.object({
  asset: z.enum(["BTC", "ETH"]),
  intervalSec: z.number().int().positive(),
  budget: z.number().positive().max(10_000),
  maxEntryPrice: z.number().gt(0).lt(1),
  path: z.array(outcomeSchema).min(2).max(5),
});

export type PlanInput = z.infer<typeof planInputSchema>;

export interface LiveMarket {
  marketId: `0x${string}`;
  asset: "BTC" | "ETH";
  intervalSec: number;
  expiry: number;
  venueId: `0x${string}`;
  poolAddress: `0x${string}`;
  onchainStatus: number;
  verifiedAt: string;
}

export interface BranchLeg {
  index: number;
  expected: Outcome;
  allocation: number;
  condition: string;
  binding:
    | { kind: "market"; marketId: `0x${string}`; expiry: number; venueId: `0x${string}`; poolAddress: `0x${string}` }
    | { kind: "selector"; asset: "BTC" | "ETH"; intervalSec: number };
}

export interface BranchPlan {
  asset: "BTC" | "ETH";
  intervalSec: number;
  budget: number;
  maxEntryPrice: number;
  legs: BranchLeg[];
  stopRule: string;
}

export function createBranchPlan(input: PlanInput, market: LiveMarket): BranchPlan {
  const parsed = planInputSchema.parse(input);
  if (market.asset !== parsed.asset || market.intervalSec !== parsed.intervalSec) {
    throw new Error("Selected market does not match the branch asset and cadence.");
  }
  if (market.onchainStatus !== 1 || market.expiry <= Math.floor(Date.now() / 1000) + 15) {
    throw new Error("Selected market is not safely tradable on-chain.");
  }

  const allocation = Number((parsed.budget / parsed.path.length).toFixed(2));
  const legs = parsed.path.map<BranchLeg>((expected, index) => ({
    index,
    expected,
    allocation,
    condition: index === 0 ? "Start" : `Continue only if leg ${index} settles ${parsed.path[index - 1]}`,
    binding:
      index === 0
        ? { kind: "market", marketId: market.marketId, expiry: market.expiry, venueId: market.venueId, poolAddress: market.poolAddress }
        : { kind: "selector", asset: parsed.asset, intervalSec: parsed.intervalSec },
  }));

  return {
    asset: parsed.asset,
    intervalSec: parsed.intervalSec,
    budget: parsed.budget,
    maxEntryPrice: parsed.maxEntryPrice,
    legs,
    stopRule: "Stop on the first mismatched or voided outcome; never execute later legs.",
  };
}

export type Resolution = Outcome | "VOID";

export function nextBranchState(expected: Outcome, resolution: Resolution): "CONTINUE" | "TERMINATE" {
  return resolution === expected ? "CONTINUE" : "TERMINATE";
}
