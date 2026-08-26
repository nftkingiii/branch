import { describe, expect, it } from "vitest";
import { parseExecutionGuardQuery } from "./execution-guard.js";

const marketId = `0x${"ab".repeat(32)}`;
const pool = `0x${"cd".repeat(20)}`;

describe("execution guard boundary", () => {
  it("accepts a bytes32 market and address-sized pool", () => {
    expect(parseExecutionGuardQuery(new URL(`http://branch/api/execution-guard?marketId=${marketId}&pool=${pool}`)))
      .toEqual({ marketId, pool });
  });

  it("rejects an address in place of a market ID", () => {
    expect(parseExecutionGuardQuery(new URL(`http://branch/api/execution-guard?marketId=${pool}&pool=${pool}`))).toBeNull();
  });

  it("rejects missing parameters", () => {
    expect(parseExecutionGuardQuery(new URL("http://branch/api/execution-guard"))).toBeNull();
  });
});

