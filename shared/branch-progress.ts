import type { PositionsResponse } from "./positions.js";

export type BranchProgressState = "active" | "ready" | "stopped" | "complete" | "unverified";

export interface BranchExecutionLike {
  path: Array<"UP" | "DOWN">;
  legs: Array<{ marketId: string; expected: "UP" | "DOWN" }>;
}

export function deriveBranchProgress(execution: BranchExecutionLike, data: PositionsResponse): {
  state: BranchProgressState;
  nextLegIndex: number | null;
} {
  const last = execution.legs.at(-1);
  if (!last) return { state: "unverified", nextLegIndex: null };
  const marketId = last.marketId.toLowerCase();
  const open = data.positions.find((position) =>
    position.marketId.toLowerCase() === marketId && position.outcome === last.expected,
  );
  if (open) {
    if (open.lifecycle === "lost" || open.lifecycle === "voided") return { state: "stopped", nextLegIndex: null };
    if (open.lifecycle !== "claimable") return { state: "active", nextLegIndex: null };
  } else {
    const closed = data.closed.find((position) =>
      position.marketId.toLowerCase() === marketId && position.outcome === last.expected,
    );
    if (!closed) return { state: "unverified", nextLegIndex: null };
    if (closed.result !== "won") return { state: "stopped", nextLegIndex: null };
  }
  if (execution.legs.length >= execution.path.length) return { state: "complete", nextLegIndex: null };
  return { state: "ready", nextLegIndex: execution.legs.length };
}
