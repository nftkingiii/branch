import { quoteBinaryStakeOverBook, type BinaryBookParams, type BinaryOrderBook } from "@somnia-chain/markets-sdk";

const ONE_COLLATERAL = 1_000_000n;

export function quoteFillableFirstLeg(params: {
  book: BinaryOrderBook;
  side: "BUY_YES" | "BUY_NO";
  allocation: number;
  maximumOutcomePrice: bigint;
  grid: BinaryBookParams;
}) {
  const stake = BigInt(Math.floor(params.allocation * Number(ONE_COLLATERAL)));
  const quote = quoteBinaryStakeOverBook(params.book, params.side, stake, ONE_COLLATERAL, params.grid);
  if (!quote) {
    throw new Error("No immediately fillable liquidity is available for this outcome. Refresh the branch and try again later.");
  }
  if (quote.limitPrice > params.maximumOutcomePrice) {
    throw new Error(`The best fillable ${params.side === "BUY_YES" ? "UP" : "DOWN"} price is above your maximum entry probability.`);
  }
  return { yesLimitPrice: quote.yesPrice, quantity: quote.quantity };
}

