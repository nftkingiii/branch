import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import { createPublicClient, createWalletClient, custom, defineChain, formatUnits, http, type Address, type EIP1193Provider } from "viem";
import { createExecutionIntent } from "../shared/execution.js";
import { quoteFillableFirstLeg } from "../shared/liquidity.js";
import type { BranchPlan } from "../shared/branch.js";
import type { PositionSnapshot, PositionsResponse } from "../shared/positions.js";
import { describeWalletError, isUnrecognizedChainError } from "../shared/provider-error.js";

export const SOMNIA_CHAIN_ID = 50312;
const RPC_URL = "https://api.infra.testnet.somnia.network";

export const somniaChain = defineChain({
  id: SOMNIA_CHAIN_ID,
  name: "Somnia Shannon Testnet",
  nativeCurrency: { name: "Somnia Test Token", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Somnia Explorer", url: "https://shannon-explorer.somnia.network" } },
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

const publicClient = createPublicClient({ chain: somniaChain, transport: http("/api/rpc") });
const exchange = new SomniaMarkets({
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
  chain: somniaChain,
  wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
  addresses,
});

declare global {
  interface Window { ethereum?: EIP1193Provider & { providers?: Array<EIP1193Provider & { isMetaMask?: boolean }> }; }
}

export interface WalletSession { address: Address; provider: EIP1193Provider; }
export interface ExecutionReceipt {
  hash: `0x${string}`;
  status: "success";
  blockNumber: bigint;
  fills: number;
  orderId?: bigint;
}
export interface FundingStatus { stt: string; testUsdc: string; hasGas: boolean; }
interface ExecutionGuardResponse {
  status: number;
  pool: Address;
  marketExpiryNs: string;
  tickSize: string;
  lotSize: string;
  minQuantity: string;
  book: Record<"yesBids" | "yesAsks" | "noBids" | "noAsks", Array<{ price: string; quantity: string }>>;
}

export async function connectWallet(): Promise<WalletSession> {
  const injected = window.ethereum;
  const provider = injected?.providers?.find((candidate) => candidate.isMetaMask) ?? injected?.providers?.[0] ?? injected;
  if (!provider) throw new Error("No injected wallet was found. Open Branch in the wallet's browser or install an EVM wallet extension.");
  let accounts: Address[];
  try {
    accounts = await provider.request({ method: "eth_requestAccounts" }) as Address[];
  } catch (error) {
    throw new Error(describeWalletError(error, "connect"));
  }
  const address = accounts[0];
  if (!address) throw new Error("The wallet did not return an account.");
  const current = await provider.request({ method: "eth_chainId" }) as string;
  if (Number.parseInt(current, 16) !== SOMNIA_CHAIN_ID) {
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xc488" }] });
    } catch (error) {
      if (!isUnrecognizedChainError(error)) throw new Error(describeWalletError(error, "network"));
      try {
        await provider.request({ method: "wallet_addEthereumChain", params: [{
          chainId: "0xc488",
          chainName: somniaChain.name,
          nativeCurrency: somniaChain.nativeCurrency,
          rpcUrls: [RPC_URL],
          blockExplorerUrls: [somniaChain.blockExplorers.default.url],
        }] });
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xc488" }] });
      } catch (addError) {
        throw new Error(describeWalletError(addError, "network"));
      }
    }
  }
  const verifiedChain = await provider.request({ method: "eth_chainId" }) as string;
  if (Number.parseInt(verifiedChain, 16) !== SOMNIA_CHAIN_ID) throw new Error("Wallet remained on the wrong network. Switch to Somnia Shannon (50312) and retry.");
  return { address, provider };
}

export async function getFundingStatus(session: WalletSession): Promise<FundingStatus> {
  const [stt, testUsdc] = await Promise.all([
    publicClient.getBalance({ address: session.address }),
    publicClient.readContract({
      address: addresses.collateral,
      abi: [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] }],
      functionName: "balanceOf",
      args: [session.address],
    }),
  ]);
  return { stt: Number(formatUnits(stt, 18)).toFixed(3), testUsdc: Number(formatUnits(testUsdc, 6)).toFixed(2), hasGas: stt > 0n };
}

export async function requestTestCollateral(session: WalletSession): Promise<ExecutionReceipt> {
  const walletClient = createWalletClient({ account: session.address, chain: somniaChain, transport: custom(session.provider) });
  const trader = exchange.client.createTrader({ walletClient, account: session.address, publicClient });
  const result = await trader.faucet({ amount: 1_000n * 1_000_000n });
  if (result.receipt.status !== "success") throw new Error("The TestUSDC faucet transaction reverted.");
  return { hash: result.hash, status: "success", blockNumber: result.receipt.blockNumber, fills: 0 };
}

export async function claimPosition(session: WalletSession, requested: PositionSnapshot): Promise<ExecutionReceipt> {
  const currentChain = await session.provider.request({ method: "eth_chainId" }) as string;
  if (Number.parseInt(currentChain, 16) !== SOMNIA_CHAIN_ID) {
    throw new Error("Switch the wallet to Somnia Shannon (50312) before claiming.");
  }
  const response = await fetch(`/api/positions?account=${encodeURIComponent(session.address)}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("The position could not be re-verified before claiming.");
  const snapshot = await response.json() as PositionsResponse;
  const verified = snapshot.positions.find((position) =>
    position.marketId.toLowerCase() === requested.marketId.toLowerCase()
    && position.outcomeIndex === requested.outcomeIndex
    && position.lifecycle === "claimable"
    && position.claimableAmountRaw != null,
  );
  if (!verified?.claimableAmountRaw) throw new Error("This position is not currently claimable on-chain.");

  const walletClient = createWalletClient({ account: session.address, chain: somniaChain, transport: custom(session.provider) });
  const trader = exchange.client.createTrader({ walletClient, account: session.address, publicClient });
  try {
    const result = await trader.redeemMany({
      entries: [{
        marketId: verified.marketId,
        outcomeIdx: verified.outcomeIndex,
        amount: BigInt(verified.claimableAmountRaw),
      }],
      autoApprove: true,
    });
    if (result.receipt.status !== "success") throw new Error("The claim transaction reverted.");
    return { hash: result.hash, status: "success", blockNumber: result.receipt.blockNumber, fills: 0 };
  } catch (error) {
    throw new Error(describeWalletError(error, "transaction"));
  }
}

export async function executeFirstLeg(plan: BranchPlan, session: WalletSession): Promise<ExecutionReceipt> {
  const intent = createExecutionIntent(plan);
  if (Math.floor(Date.now() / 1000) + 20 >= Number(intent.expiryTimestampNs / 1_000_000_000n)) {
    throw new Error("This market is too close to expiry. Refresh and review a new branch.");
  }
  const guardRequest = fetch(`/api/execution-guard?marketId=${encodeURIComponent(intent.marketId)}&pool=${encodeURIComponent(intent.pool)}`, {
    headers: { Accept: "application/json" },
  });
  const [network, guardResponse] = await Promise.all([
    publicClient.getChainId(),
    guardRequest,
  ]);
  if (network !== SOMNIA_CHAIN_ID) throw new Error("RPC chain verification failed.");
  if (!guardResponse.ok) throw new Error("The bound market could not be re-verified. Refresh and preview the branch again.");
  const guard = await guardResponse.json() as ExecutionGuardResponse;
  if (guard.status !== 1) throw new Error("The bound market is no longer trading.");
  if (guard.pool.toLowerCase() !== intent.pool.toLowerCase() || BigInt(guard.marketExpiryNs) !== intent.expiryTimestampNs) {
    throw new Error("The pool has rotated to a different market generation.");
  }
  const bookParams = {
    tickSize: BigInt(guard.tickSize),
    lotSize: BigInt(guard.lotSize),
    minQuantity: BigInt(guard.minQuantity),
  };
  const parseLevels = (levels: Array<{ price: string; quantity: string }>) =>
    levels.map((level) => ({ price: BigInt(level.price), quantity: BigInt(level.quantity) }));
  const executable = quoteFillableFirstLeg({
    book: {
      yesBids: parseLevels(guard.book.yesBids),
      yesAsks: parseLevels(guard.book.yesAsks),
      noBids: parseLevels(guard.book.noBids),
      noAsks: parseLevels(guard.book.noAsks),
    },
    side: intent.side,
    allocation: intent.allocation,
    maximumOutcomePrice: intent.selectedOutcomePrice,
    grid: bookParams,
  });
  const funding = await getFundingStatus(session);
  if (!funding.hasGas) throw new Error("This wallet needs test STT for gas before it can execute.");
  if (Number(funding.testUsdc) < intent.allocation) throw new Error("This wallet needs more TestUSDC collateral. Use the in-app collateral faucet first.");

  const walletClient = createWalletClient({ account: session.address, chain: somniaChain, transport: custom(session.provider) });
  const trader = exchange.client.createTrader({ walletClient, account: session.address, publicClient });
  let result;
  try {
    result = await trader.placeOrder({
      pool: intent.pool,
      side: intent.side,
      price: executable.yesLimitPrice,
      quantity: executable.quantity,
      expireTimestampNs: intent.expiryTimestampNs,
      orderType: 2,
      autoApprove: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ImmediateOrCancelNoFill")) {
      throw new Error("Liquidity moved before the IOC reached DreamDEX, so nothing filled. Refresh the branch and retry; no position was created.");
    }
    throw error;
  }
  if (result.receipt.status !== "success") throw new Error("The order transaction reverted.");
  return { hash: result.hash, status: "success", blockNumber: result.receipt.blockNumber, fills: result.fills.length, orderId: result.orderId };
}
