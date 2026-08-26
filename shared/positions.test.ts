import { describe, expect, it } from "vitest";
import { classifyPosition, deriveFilledPosition, derivePositionCostBasis, formatRawAmount, parsePositionAccount } from "./positions.js";

describe("position lifecycle", () => {
  const base = { status: 1, expiry: 2_000, now: 1_000, finalized: false, isResolved: false, isVoided: false, winningOutcome: null, outcomeIndex: 1 };

  it("marks an open market live and an expired market settling", () => {
    expect(classifyPosition(base)).toBe("live");
    expect(classifyPosition({ ...base, now: 2_001 })).toBe("settling");
  });

  it("separates a losing terminal position from a claimable winner", () => {
    expect(classifyPosition({ ...base, status: 4, isResolved: true, finalized: true, winningOutcome: 0 })).toBe("lost");
    expect(classifyPosition({ ...base, status: 4, isResolved: true, finalized: true, winningOutcome: 1 })).toBe("claimable");
  });

  it("keeps a resolved winner waiting until finalization", () => {
    expect(classifyPosition({ ...base, status: 4, isResolved: true, winningOutcome: 1 })).toBe("won");
  });
});

describe("position boundary helpers", () => {
  it("accepts only valid wallet addresses", () => {
    expect(parsePositionAccount("0x8aab2e27bd9ce18ca44722cce48adcc10df0c4c4")).toBe("0x8aAB2E27bd9Ce18Ca44722CCE48ADCc10df0C4c4");
    expect(parsePositionAccount("not-a-wallet")).toBeNull();
  });

  it("formats signed fixed-point values without floating point loss", () => {
    expect(formatRawAmount("115830000", 6)).toBe("115.83");
    expect(formatRawAmount("-24671790", 6, 2)).toBe("−24.67");
  });

  it("derives NO cost basis from stable-market fill history", () => {
    expect(derivePositionCostBasis({
      outcomeIndex: 1,
      balanceRaw: "115830000",
      decimals: 6,
      fills: [{ quantityRaw: "115830000", yesPriceRaw: "787000", side: "BUY_NO", timestamp: 1 }],
    })).toEqual({ costBasisRaw: "24671790", averageEntryRaw: "213000" });
  });

  it("reconstructs a redeemed position from fills after its token balance is gone", () => {
    expect(deriveFilledPosition({
      outcomeIndex: 1,
      decimals: 6,
      fills: [{ quantityRaw: "57361000", yesPriceRaw: "493000", side: "BUY_NO", timestamp: 1 }],
    })).toEqual({ quantityRaw: "57361000", costBasisRaw: "29082027", averageEntryRaw: "507000" });
  });

  it("reduces quantity and cost proportionally when part of a position was sold", () => {
    expect(deriveFilledPosition({
      outcomeIndex: 0,
      decimals: 6,
      fills: [
        { quantityRaw: "10000000", yesPriceRaw: "400000", side: "BUY_YES", timestamp: 1 },
        { quantityRaw: "2500000", yesPriceRaw: "500000", side: "SELL_YES", timestamp: 2 },
      ],
    })).toEqual({ quantityRaw: "7500000", costBasisRaw: "3000000", averageEntryRaw: "400000" });
  });
});
