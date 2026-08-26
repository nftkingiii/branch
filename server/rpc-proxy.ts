import { z } from "zod";

const allowedRpcMethods = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
]);

const rpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]),
  method: z.string(),
  params: z.array(z.unknown()).optional(),
}).strict();

export function validateRpcRequest(value: unknown) {
  const parsed = rpcRequestSchema.safeParse(value);
  if (!parsed.success || !allowedRpcMethods.has(parsed.data.method)) return null;
  return parsed.data;
}

