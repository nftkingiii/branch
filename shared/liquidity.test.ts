import { describe, expect, it } from "vitest";
import type { BinaryOrderBook } from "@somnia-chain/markets-sdk";
import { quoteFillableFirstLeg } from "./liquidity.js";

const grid = { tickSize: 1_000n, lotSize: 1_000n, minQuantity: 1_000n };
const empty: BinaryOrderBook = { yesBids: [], yesAsks: [], noBids: [], noAsks: [] };

describe("first-leg liquidity preflight", () => {
  it("rejects an empty IOC book before wallet submission", () => {
    expect(() => quoteFillableFirstLeg({ book: empty, side: "BUY_YES", allocation: 30, maximumOutcomePrice: 720_000n, grid }))
      .toThrow("No immediately fillable liquidity");
  });

  it("rejects liquidity above the user's probability cap", () => {
    const book: BinaryOrderBook = { ...empty, yesAsks: [{ price: 800_000n, quantity: 100_000_000n }] };
    expect(() => quoteFillableFirstLeg({ book, side: "BUY_YES", allocation: 30, maximumOutcomePrice: 720_000n, grid }))
      .toThrow("above your maximum entry probability");
  });

  it("returns an aligned fillable quote within the cap", () => {
    const book: BinaryOrderBook = { ...empty, noAsks: [{ price: 600_000n, quantity: 100_000_000n }] };
    const quote = quoteFillableFirstLeg({ book, side: "BUY_NO", allocation: 30, maximumOutcomePrice: 720_000n, grid });
    expect(quote.quantity).toBeGreaterThan(0n);
    expect(quote.yesLimitPrice).toBeLessThan(500_000n);
  });
});

