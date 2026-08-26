import { describe, expect, it } from "vitest";
import { deriveBranchProgress, type BranchExecutionLike } from "./branch-progress.js";
import type { PositionsResponse } from "./positions.js";

const execution: BranchExecutionLike = {
  path: ["DOWN", "UP"],
  legs: [{ marketId: `0x${"1".repeat(64)}`, expected: "DOWN" }],
};
const empty: PositionsResponse = { account: `0x${"2".repeat(40)}`, fetchedAt: "now", positions: [], activity: [], closed: [] };

describe("deriveBranchProgress", () => {
  it("unlocks the next leg only after a verified win", () => {
    expect(deriveBranchProgress(execution, {
      ...empty,
      closed: [{
        id: "winner", marketId: execution.legs[0].marketId as `0x${string}`, asset: "BTC", question: "q", interval: "15m",
        outcome: "DOWN", outcomeIndex: 1, winningOutcome: "DOWN", result: "won", quantityRaw: "1", costBasisRaw: "1",
        averageEntryRaw: "1", payoutRaw: "1", pnlRaw: "0", quoteDecimals: 6, closedAt: 1,
        executionTxHash: `0x${"3".repeat(64)}`, settlementTxHash: null, claimState: "claimable",
      }],
    })).toEqual({ state: "ready", nextLegIndex: 1 });
  });

  it("stops after a mismatch and fails closed when evidence is absent", () => {
    expect(deriveBranchProgress(execution, { ...empty, closed: [{
      id: "loser", marketId: execution.legs[0].marketId as `0x${string}`, asset: "BTC", question: "q", interval: "15m",
      outcome: "DOWN", outcomeIndex: 1, winningOutcome: "UP", result: "lost", quantityRaw: "1", costBasisRaw: "1",
      averageEntryRaw: "1", payoutRaw: "0", pnlRaw: "-1", quoteDecimals: 6, closedAt: 1,
      executionTxHash: `0x${"3".repeat(64)}`, settlementTxHash: null, claimState: "no-payout",
    }] })).toEqual({ state: "stopped", nextLegIndex: null });
    expect(deriveBranchProgress(execution, empty)).toEqual({ state: "unverified", nextLegIndex: null });
  });
});
