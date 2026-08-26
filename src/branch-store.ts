import { z } from "zod";
import type { BranchPlan } from "../shared/branch";
import type { ExecutionReceipt, WalletSession } from "./wallet";

const storedExecutionSchema = z.object({
  version: z.literal(2),
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  asset: z.enum(["BTC", "ETH"]),
  intervalSec: z.number().int().positive(),
  path: z.array(z.enum(["UP", "DOWN"])).min(2).max(5),
  allocation: z.number().positive().max(100),
  maxEntryPrice: z.number().min(0.01).max(0.99),
  legs: z.array(z.object({
    index: z.number().int().nonnegative(),
    expected: z.enum(["UP", "DOWN"]),
    marketId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    expiry: z.number().int().positive(),
    filledAt: z.number().int().positive(),
  })).min(1).max(5),
});

export type StoredBranchExecution = z.infer<typeof storedExecutionSchema>;
const storageKey = "branch.executions.v1";

export function rememberBranchExecution(session: WalletSession, plan: BranchPlan, receipt: ExecutionReceipt): void {
  if (!receipt.fills || plan.legs[0]?.binding.kind !== "market") return;
  const next: StoredBranchExecution = {
    version: 2,
    wallet: session.address.toLowerCase(),
    asset: plan.asset,
    intervalSec: plan.intervalSec,
    path: plan.legs.map((leg) => leg.expected),
    allocation: plan.legs[0].allocation,
    maxEntryPrice: plan.maxEntryPrice,
    legs: [{
      index: 0,
      expected: plan.legs[0].expected,
      marketId: plan.legs[0].binding.marketId.toLowerCase(),
      txHash: receipt.hash.toLowerCase(),
      expiry: plan.legs[0].binding.expiry,
      filledAt: Math.floor(Date.now() / 1000),
    }],
  };
  const existing = readStoredExecutions();
  const deduped = existing.filter((item) => item.legs[0].txHash !== next.legs[0].txHash);
  localStorage.setItem(storageKey, JSON.stringify([next, ...deduped].slice(0, 20)));
}

export function rememberContinuation(
  execution: StoredBranchExecution,
  input: { index: number; marketId: string; txHash: string; expiry: number },
): void {
  if (input.index !== execution.legs.length || input.index >= execution.path.length) return;
  const next = storedExecutionSchema.parse({
    ...execution,
    legs: [...execution.legs, {
      index: input.index,
      expected: execution.path[input.index],
      marketId: input.marketId.toLowerCase(),
      txHash: input.txHash.toLowerCase(),
      expiry: input.expiry,
      filledAt: Math.floor(Date.now() / 1000),
    }],
  });
  const existing = readStoredExecutions();
  localStorage.setItem(storageKey, JSON.stringify([next, ...existing.filter(
    (item) => item.legs[0].txHash !== execution.legs[0].txHash,
  )].slice(0, 20)));
}

export function readBranchExecutions(wallet: string): StoredBranchExecution[] {
  const normalized = wallet.toLowerCase();
  return readStoredExecutions().filter((item) => item.wallet === normalized);
}

function readStoredExecutions(): StoredBranchExecution[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    const result = z.array(storedExecutionSchema).safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}
