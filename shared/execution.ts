import { z } from "zod";
import type { BranchPlan, Outcome } from "./branch.js";

const SCALE = 1_000_000n;

export const executionIntentSchema = z.object({
  marketId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  pool: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  outcome: z.enum(["UP", "DOWN"]),
  allocation: z.number().positive().max(100),
  maxEntryPrice: z.number().min(0.01).max(0.99),
  expiry: z.number().int().positive(),
});

export interface ExecutionIntent {
  marketId: `0x${string}`;
  pool: `0x${string}`;
  outcome: Outcome;
  side: "BUY_YES" | "BUY_NO";
  allocation: number;
  selectedOutcomePrice: bigint;
  yesLimitPrice: bigint;
  quantity: bigint;
  expiryTimestampNs: bigint;
}

export interface ExecutableOrder {
  yesLimitPrice: bigint;
  quantity: bigint;
}

export function createExecutionIntent(plan: BranchPlan): ExecutionIntent {
  const first = plan.legs[0];
  if (!first || first.binding.kind !== "market") throw new Error("The first leg is not bound to a live market.");

  const parsed = executionIntentSchema.parse({
    marketId: first.binding.marketId,
    pool: first.binding.poolAddress,
    outcome: first.expected,
    allocation: first.allocation,
    maxEntryPrice: plan.maxEntryPrice,
    expiry: first.binding.expiry,
  });
  const selectedOutcomePrice = BigInt(Math.round(parsed.maxEntryPrice * Number(SCALE)));
  const yesLimitPrice = parsed.outcome === "UP" ? selectedOutcomePrice : SCALE - selectedOutcomePrice;
  const stake = BigInt(Math.floor(parsed.allocation * Number(SCALE)));
  const quantity = (stake * SCALE) / selectedOutcomePrice;
  if (quantity <= 0n) throw new Error("The leg allocation is below the executable minimum.");

  return {
    marketId: parsed.marketId as `0x${string}`,
    pool: parsed.pool as `0x${string}`,
    outcome: parsed.outcome,
    side: parsed.outcome === "UP" ? "BUY_YES" : "BUY_NO",
    allocation: parsed.allocation,
    selectedOutcomePrice,
    yesLimitPrice,
    quantity,
    expiryTimestampNs: BigInt(parsed.expiry) * 1_000_000_000n,
  };
}

export function alignExecutionIntent(
  intent: ExecutionIntent,
  params: { tickSize: bigint; lotSize: bigint; minQuantity: bigint },
): ExecutableOrder {
  if (params.tickSize <= 0n || params.lotSize <= 0n || params.minQuantity <= 0n) {
    throw new Error("DreamDEX returned an invalid order grid.");
  }
  const remainder = intent.yesLimitPrice % params.tickSize;
  const yesLimitPrice = intent.outcome === "UP"
    ? intent.yesLimitPrice - remainder
    : remainder === 0n ? intent.yesLimitPrice : intent.yesLimitPrice + params.tickSize - remainder;
  const quantity = intent.quantity - (intent.quantity % params.lotSize);
  if (yesLimitPrice <= 0n || yesLimitPrice >= SCALE) throw new Error("The aligned probability limit is not executable.");
  if (quantity < params.minQuantity) throw new Error("The leg allocation is below DreamDEX's minimum order size.");
  return { yesLimitPrice, quantity };
}
