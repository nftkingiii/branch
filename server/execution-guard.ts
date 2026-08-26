import { z } from "zod";

const executionGuardQuerySchema = z.object({
  marketId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  pool: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
}).strict();

export function parseExecutionGuardQuery(url: URL) {
  const parsed = executionGuardQuerySchema.safeParse({
    marketId: url.searchParams.get("marketId"),
    pool: url.searchParams.get("pool"),
  });
  return parsed.success ? parsed.data : null;
}

