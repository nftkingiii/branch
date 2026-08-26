import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import { createPublicClient, defineChain, http, type Address } from "viem";
import type { LiveMarket } from "../shared/branch.js";
import { classifyPosition, deriveFilledPosition, derivePositionCostBasis, type ClosedPositionSnapshot, type PositionActivity, type PositionsResponse, type PositionSnapshot } from "../shared/positions.js";

const chain = defineChain({
  id: 50312,
  name: "Somnia Shannon Testnet",
  nativeCurrency: { name: "Somnia Test Token", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: ["https://api.infra.testnet.somnia.network"] } },
});

const addresses = {
  collateral: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
  testUsdc: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
  binaryModule: "0x3ecC694Cef705358864a646142ac17A90E29e388",
  marketsCore: "0x2802504314685D89bF6C992CA5a8e7cC78bc0294",
  marketCreator: "0x5Ce69567dB39C8fBAd7e048bEfdbcCdfE67B44e6",
  clobFactory: "0xb2BE8EE02F96379DB75f01802384593EBa9bfF04",
  binaryPoolImpl: "0x82A1FcdaA2daC2fC7D5f9909D43E68021eE966FD",
  binarySettlement: "0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23",
  collateralRouter: "0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C",
  marketCreatorFactory: "0xE6bEE93cE87c9E6e62aCb621caa7832EE47b4F6B",
  oracleHub: "0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b",
} as const;

const exchange = new SomniaMarkets({
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
  chain,
  wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
  addresses,
});
const publicClient = createPublicClient({ chain, transport: http("https://api.infra.testnet.somnia.network") });

export interface MarketResponse {
  chainId: 50312;
  source: "DreamDEX Event Contracts";
  fetchedAt: string;
  markets: LiveMarket[];
  excluded: { expired: number; unverified: number; notTradingOnchain: number };
}

export async function fetchVerifiedMarkets(): Promise<MarketResponse> {
  const fetchedAt = new Date();
  const now = Math.floor(fetchedAt.getTime() / 1000);
  const rows = await exchange.client.listBinaryMarkets({ status: "Trading", limit: 50 });
  const excluded = { expired: 0, unverified: 0, notTradingOnchain: 0 };
  const markets: LiveMarket[] = [];

  for (const row of rows) {
    const expiry = Number(row.expiry ?? 0);
    if (expiry <= now + 15) {
      excluded.expired += 1;
      continue;
    }
    try {
      const onchain = await exchange.client.getMarketOnchain(row.marketId as `0x${string}`);
      if (onchain.status !== 1) {
        excluded.notTradingOnchain += 1;
        continue;
      }
      if ((row.asset !== "BTC" && row.asset !== "ETH") || !row.venueId || !row.poolAddress) {
        excluded.unverified += 1;
        continue;
      }
      markets.push({
        marketId: row.marketId as `0x${string}`,
        asset: row.asset,
        intervalSec: Number(row.intervalSec),
        expiry,
        venueId: row.venueId as `0x${string}`,
        poolAddress: row.poolAddress as `0x${string}`,
        onchainStatus: Number(onchain.status),
        verifiedAt: fetchedAt.toISOString(),
      });
    } catch {
      excluded.unverified += 1;
    }
  }

  return {
    chainId: 50312,
    source: "DreamDEX Event Contracts",
    fetchedAt: fetchedAt.toISOString(),
    markets: markets.sort((a, b) => a.intervalSec - b.intervalSec || a.asset.localeCompare(b.asset)),
    excluded,
  };
}

export async function verifyExecutionMarket(marketId: `0x${string}`, expectedPool: Address) {
  const onchain = await exchange.client.getMarketOnchain(marketId);
  if (onchain.pool.toLowerCase() !== expectedPool.toLowerCase()) {
    throw new Error("The market is bound to a different pool generation.");
  }
  const [marketExpiryNs, bookParams, book] = await Promise.all([
    publicClient.readContract({
      address: expectedPool,
      abi: [{ type: "function", name: "marketExpiryNs", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] }],
      functionName: "marketExpiryNs",
    }),
    exchange.client.getBinaryBookParams(expectedPool),
    exchange.client.getBinaryOrderBook(expectedPool, { depth: 12, decimals: 6 }),
  ]);
  const serializeLevels = (levels: Array<{ price: bigint; quantity: bigint }>) =>
    levels.map((level) => ({ price: level.price.toString(), quantity: level.quantity.toString() }));
  return {
    status: onchain.status,
    pool: onchain.pool,
    marketExpiryNs: marketExpiryNs.toString(),
    tickSize: bookParams.tickSize.toString(),
    lotSize: bookParams.lotSize.toString(),
    minQuantity: bookParams.minQuantity.toString(),
    book: {
      yesBids: serializeLevels(book.yesBids),
      yesAsks: serializeLevels(book.yesAsks),
      noBids: serializeLevels(book.noBids),
      noAsks: serializeLevels(book.noAsks),
    },
  };
}

export async function fetchWalletPositions(account: Address): Promise<PositionsResponse> {
  const [portfolio, fills, routerActions] = await Promise.all([
    exchange.client.getPortfolio(account, { ordersLimit: 0, tradesLimit: 0 }),
    exchange.client.getUserFills(account, { limit: 20 }),
    exchange.client.getRouterActions(account, { kind: "Redeem", limit: 50 }).catch(() => []),
  ]);
  const now = Math.floor(Date.now() / 1000);
  const latestTradeByMarket = new Map<string, `0x${string}`>();
  for (const fill of fills) {
    if (!latestTradeByMarket.has(fill.market.toLowerCase())) {
      latestTradeByMarket.set(fill.market.toLowerCase(), fill.txHash as `0x${string}`);
    }
  }

  const marketIds = [...new Set([
    ...portfolio.positions.slice(0, 50).map((position) => position.market.id.toLowerCase()),
    ...fills.map((fill) => fill.market.toLowerCase()),
  ])];
  const marketDetails = new Map(await Promise.all(marketIds.map(async (marketId) => {
    const [indexed, onchain] = await Promise.all([
      exchange.client.getBinaryMarket(marketId),
      exchange.client.getMarketOnchain(marketId as `0x${string}`),
    ]);
    return [marketId, { indexed, onchain }] as const;
  })));

  const normalizedFills = fills.map((fill) => {
    const asMaker = fill.maker?.toLowerCase() === account.toLowerCase();
    return {
      fill,
      side: asMaker ? fill.makerSide : (fill.takerOrder?.side ?? fill.takerSide),
    };
  });

  const positions = await Promise.all(portfolio.positions.slice(0, 50).map(async (position): Promise<PositionSnapshot> => {
    const marketId = position.market.id as `0x${string}`;
    const onchain = marketDetails.get(marketId.toLowerCase())!.onchain;
    const outcomeIndex = position.outcomeIndex === 0 ? 0 : 1;
    const winningIndex = onchain.winningOutcome == null ? null : Number(onchain.winningOutcome);
    const lifecycle = classifyPosition({
      status: Number(onchain.status),
      expiry: Number(onchain.expiry),
      now,
      finalized: onchain.finalized,
      isResolved: onchain.isResolved,
      isVoided: onchain.isVoided,
      winningOutcome: winningIndex,
      outcomeIndex,
    });
    const positionFills = normalizedFills.filter(({ fill }) => fill.market.toLowerCase() === marketId.toLowerCase()).map(({ fill, side }) => {
      return {
        quantityRaw: fill.quantity,
        yesPriceRaw: fill.fillPrice,
        side,
        timestamp: Number(fill.timestamp),
      };
    });
    const cost = derivePositionCostBasis({
      outcomeIndex,
      balanceRaw: position.balance,
      decimals: position.market.quoteDecimals,
      fills: positionFills,
    });
    const scale = 10n ** BigInt(position.market.quoteDecimals);
    const balance = BigInt(position.balance);
    const indexerYesPrice = BigInt(position.market.lastPrice ?? "0");
    const outcomeMark = outcomeIndex === 0 ? indexerYesPrice : scale - indexerYesPrice;
    const markValue = onchain.isVoided
      ? balance / 2n
      : onchain.isResolved
        ? winningIndex === outcomeIndex ? balance : 0n
        : balance * outcomeMark / scale;
    const unrealizedPnl = markValue - BigInt(cost.costBasisRaw);
    return {
      marketId,
      pool: onchain.pool.toLowerCase() as `0x${string}`,
      asset: position.market.asset,
      question: position.market.question,
      interval: position.market.interval,
      expiry: Number(onchain.expiry),
      outcome: outcomeIndex === 0 ? "UP" : "DOWN",
      outcomeIndex,
      balanceRaw: position.balance,
      quoteDecimals: position.market.quoteDecimals,
      costBasisRaw: cost.costBasisRaw,
      averageEntryRaw: cost.averageEntryRaw,
      markValueRaw: markValue.toString(),
      unrealizedPnlRaw: unrealizedPnl.toString(),
      lifecycle,
      winningOutcome: winningIndex === 0 ? "UP" : winningIndex === 1 ? "DOWN" : null,
      finalized: onchain.finalized,
      claimableAmountRaw: lifecycle === "claimable" ? position.balance : null,
      latestTradeHash: latestTradeByMarket.get(marketId.toLowerCase()) ?? null,
    };
  }));

  const marketContext = new Map(positions.map((position) => [position.marketId.toLowerCase(), position]));
  const activity: PositionActivity[] = normalizedFills.map(({ fill, side }) => {
    const indexed = marketDetails.get(fill.market.toLowerCase())?.indexed;
    const context = marketContext.get(fill.market.toLowerCase());
    return {
      id: fill.id,
      marketId: fill.market as `0x${string}`,
      asset: context?.asset ?? indexed?.asset ?? "Event contract",
      interval: context?.interval ?? indexed?.interval ?? null,
      side: side ?? "FILLED",
      quantityRaw: fill.quantity,
      priceRaw: fill.fillPrice,
      quoteDecimals: context?.quoteDecimals ?? 6,
      timestamp: Number(fill.timestamp),
      txHash: fill.txHash as `0x${string}`,
    };
  });

  const currentBalances = new Map(portfolio.positions.map((position) => [
    `${position.market.id.toLowerCase()}:${position.outcomeIndex === 0 ? 0 : 1}`,
    BigInt(position.balance),
  ]));
  const closed: ClosedPositionSnapshot[] = [];
  for (const marketId of marketIds) {
    const details = marketDetails.get(marketId);
    if (!details?.indexed) continue;
    const { indexed, onchain } = details;
    const winningIndex = onchain.winningOutcome == null ? null : Number(onchain.winningOutcome);
    if (!onchain.isResolved && !onchain.isVoided) continue;
    const marketFills = normalizedFills.filter(({ fill }) => fill.market.toLowerCase() === marketId);
    const redemptions = routerActions.filter((action) => action.market?.toLowerCase() === marketId && action.kind === "Redeem");
    const redeemedAmount = redemptions.reduce((sum, action) => sum + BigInt(action.amount), 0n);
    const redeemedPayout = redemptions.reduce((sum, action) => sum + BigInt(action.payout ?? "0"), 0n);

    for (const outcomeIndex of [0, 1] as const) {
      const fillSummary = deriveFilledPosition({
        outcomeIndex,
        decimals: indexed.quoteDecimals,
        fills: marketFills.map(({ fill, side }) => ({
          quantityRaw: fill.quantity,
          yesPriceRaw: fill.fillPrice,
          side,
          timestamp: Number(fill.timestamp),
        })),
      });
      const quantity = BigInt(fillSummary.quantityRaw);
      if (quantity <= 0n) continue;
      const result = onchain.isVoided ? "voided" : winningIndex === outcomeIndex ? "won" : "lost";
      const currentBalance = currentBalances.get(`${marketId}:${outcomeIndex}`) ?? 0n;
      const fullyRedeemed = redemptions.length > 0 && redeemedAmount >= quantity;
      const claimState = result === "lost"
        ? "no-payout"
        : fullyRedeemed
          ? "claimed"
          : currentBalance > 0n
            ? "claimable"
            : "unknown";
      const payoutRaw = result === "lost" ? "0" : fullyRedeemed ? redeemedPayout.toString() : null;
      const pnlRaw = payoutRaw == null ? null : (BigInt(payoutRaw) - BigInt(fillSummary.costBasisRaw)).toString();
      const latestFill = marketFills.find(({ side }) => side?.endsWith(outcomeIndex === 0 ? "YES" : "NO"));
      if (!latestFill) continue;
      const latestRedemption = redemptions[0];
      closed.push({
        id: `${marketId}:${outcomeIndex}`,
        marketId: marketId as `0x${string}`,
        asset: indexed.asset,
        question: indexed.question,
        interval: indexed.interval ?? null,
        outcome: outcomeIndex === 0 ? "UP" : "DOWN",
        outcomeIndex,
        winningOutcome: winningIndex === 0 ? "UP" : winningIndex === 1 ? "DOWN" : null,
        result,
        quantityRaw: fillSummary.quantityRaw,
        costBasisRaw: fillSummary.costBasisRaw,
        averageEntryRaw: fillSummary.averageEntryRaw,
        payoutRaw,
        pnlRaw,
        quoteDecimals: indexed.quoteDecimals,
        closedAt: Number(latestRedemption?.timestamp ?? indexed.resolvedAtTimestamp ?? indexed.expiry),
        executionTxHash: latestFill.fill.txHash as `0x${string}`,
        settlementTxHash: latestRedemption ? latestRedemption.txHash as `0x${string}` : null,
        claimState,
      });
    }
  }

  return {
    account: account.toLowerCase() as `0x${string}`,
    fetchedAt: new Date().toISOString(),
    positions: positions.sort((a, b) => b.expiry - a.expiry),
    activity,
    closed: closed.sort((a, b) => b.closedAt - a.closedAt),
  };
}
