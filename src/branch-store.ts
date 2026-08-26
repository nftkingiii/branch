import { z } from "zod";
import type { BranchPlan } from "../shared/branch";
import type { ExecutionReceipt, WalletSession } from "./wallet";

const storedExecutionSchema = z.object({
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  marketId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  asset: z.enum(["BTC", "ETH"]),
  intervalSec: z.number().int().positive(),
  path: z.array(z.enum(["UP", "DOWN"])).min(2).max(5),
  filledAt: z.number().int().positive(),
});

export type StoredBranchExecution = z.infer<typeof storedExecutionSchema>;
const storageKey = "branch.executions.v1";

export function rememberBranchExecution(session: WalletSession, plan: BranchPlan, receipt: ExecutionReceipt): void {
  if (!receipt.fills || plan.legs[0]?.binding.kind !== "market") return;
  const next: StoredBranchExecution = {
    wallet: session.address.toLowerCase(),
    marketId: plan.legs[0].binding.marketId.toLowerCase(),
    txHash: receipt.hash.toLowerCase(),
    asset: plan.asset,
    intervalSec: plan.intervalSec,
    path: plan.legs.map((leg) => leg.expected),
    filledAt: Math.floor(Date.now() / 1000),
  };
  const existing = readStoredExecutions();
  const deduped = existing.filter((item) => item.txHash !== next.txHash);
  localStorage.setItem(storageKey, JSON.stringify([next, ...deduped].slice(0, 20)));
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
