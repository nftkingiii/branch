import { getAddress, isAddress } from "viem";

export type PositionLifecycle = "live" | "settling" | "claimable" | "won" | "lost" | "voided";

export interface PositionSnapshot {
  marketId: `0x${string}`;
  pool: `0x${string}`;
  asset: string;
  question: string;
  interval: string | null;
  expiry: number;
  outcome: "UP" | "DOWN";
  outcomeIndex: 0 | 1;
  balanceRaw: string;
  quoteDecimals: number;
  costBasisRaw: string;
  averageEntryRaw: string;
  markValueRaw: string;
  unrealizedPnlRaw: string;
  lifecycle: PositionLifecycle;
  winningOutcome: "UP" | "DOWN" | null;
  finalized: boolean;
  claimableAmountRaw: string | null;
  latestTradeHash: `0x${string}` | null;
}

export interface PositionActivity {
  id: string;
  marketId: `0x${string}`;
  asset: string;
  interval: string | null;
  side: string;
  quantityRaw: string;
  priceRaw: string;
  quoteDecimals: number;
  timestamp: number;
  txHash: `0x${string}`;
}

export type ClosedPositionResult = "won" | "lost" | "voided";
export type ClosedPositionClaimState = "claimed" | "claimable" | "no-payout" | "unknown";

export interface ClosedPositionSnapshot {
  id: string;
  marketId: `0x${string}`;
  asset: string;
  question: string;
  interval: string | null;
  outcome: "UP" | "DOWN";
  outcomeIndex: 0 | 1;
  winningOutcome: "UP" | "DOWN" | null;
  result: ClosedPositionResult;
  quantityRaw: string;
  costBasisRaw: string;
  averageEntryRaw: string;
  payoutRaw: string | null;
  pnlRaw: string | null;
  quoteDecimals: number;
  closedAt: number;
  executionTxHash: `0x${string}`;
  settlementTxHash: `0x${string}` | null;
  claimState: ClosedPositionClaimState;
}

export interface PositionsResponse {
  account: `0x${string}`;
  fetchedAt: string;
  positions: PositionSnapshot[];
  activity: PositionActivity[];
  closed: ClosedPositionSnapshot[];
}

export function parsePositionAccount(value: string | null): `0x${string}` | null {
  if (!value || !isAddress(value)) return null;
  return getAddress(value);
}

export function classifyPosition(input: {
  status: number;
  expiry: number;
  now: number;
  finalized: boolean;
  isResolved: boolean;
  isVoided: boolean;
  winningOutcome: number | null;
  outcomeIndex: number;
}): PositionLifecycle {
  if (input.isVoided) return input.finalized ? "claimable" : "voided";
  if (input.isResolved && input.winningOutcome != null) {
    if (input.winningOutcome !== input.outcomeIndex) return "lost";
    return input.finalized ? "claimable" : "won";
  }
  if (input.status >= 2 || input.expiry <= input.now) return "settling";
  return "live";
}

export function formatRawAmount(raw: string, decimals: number, maximumFractionDigits = 4): string {
  const value = BigInt(raw);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(decimals, "0").slice(0, maximumFractionDigits).replace(/0+$/, "");
  return `${negative ? "−" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function derivePositionCostBasis(input: {
  outcomeIndex: 0 | 1;
  balanceRaw: string;
  decimals: number;
  fills: Array<{ quantityRaw: string; yesPriceRaw: string; side: string | null; timestamp: number }>;
}): { costBasisRaw: string; averageEntryRaw: string } {
  const scale = 10n ** BigInt(input.decimals);
  let held = 0n;
  let cost = 0n;
  const outcome = input.outcomeIndex === 0 ? "YES" : "NO";
  const fills = [...input.fills].sort((a, b) => a.timestamp - b.timestamp);
  for (const fill of fills) {
    if (!fill.side?.endsWith(outcome)) continue;
    const quantity = BigInt(fill.quantityRaw);
    const yesPrice = BigInt(fill.yesPriceRaw);
    const selectedPrice = input.outcomeIndex === 0 ? yesPrice : scale - yesPrice;
    if (fill.side.startsWith("BUY_")) {
      held += quantity;
      cost += quantity * selectedPrice / scale;
    } else if (fill.side.startsWith("SELL_") && held > 0n) {
      const sold = quantity > held ? held : quantity;
      cost -= cost * sold / held;
      held -= sold;
    }
  }
  const balance = BigInt(input.balanceRaw);
  if (held > 0n && balance < held) cost = cost * balance / held;
  const average = balance > 0n ? cost * scale / balance : 0n;
  return { costBasisRaw: cost.toString(), averageEntryRaw: average.toString() };
}

export function deriveFilledPosition(input: {
  outcomeIndex: 0 | 1;
  decimals: number;
  fills: Array<{ quantityRaw: string; yesPriceRaw: string; side: string | null; timestamp: number }>;
}): { quantityRaw: string; costBasisRaw: string; averageEntryRaw: string } {
  const scale = 10n ** BigInt(input.decimals);
  let quantity = 0n;
  let cost = 0n;
  const outcome = input.outcomeIndex === 0 ? "YES" : "NO";
  for (const fill of [...input.fills].sort((a, b) => a.timestamp - b.timestamp)) {
    if (!fill.side?.endsWith(outcome)) continue;
    const fillQuantity = BigInt(fill.quantityRaw);
    const yesPrice = BigInt(fill.yesPriceRaw);
    const selectedPrice = input.outcomeIndex === 0 ? yesPrice : scale - yesPrice;
    if (fill.side.startsWith("BUY_")) {
      quantity += fillQuantity;
      cost += fillQuantity * selectedPrice / scale;
    } else if (fill.side.startsWith("SELL_") && quantity > 0n) {
      const sold = fillQuantity > quantity ? quantity : fillQuantity;
      cost -= cost * sold / quantity;
      quantity -= sold;
    }
  }
  const average = quantity > 0n ? cost * scale / quantity : 0n;
  return { quantityRaw: quantity.toString(), costBasisRaw: cost.toString(), averageEntryRaw: average.toString() };
}
