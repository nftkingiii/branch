import { describe, expect, it } from "vitest";
import { validateRpcRequest } from "./rpc-proxy.js";

describe("RPC proxy boundary", () => {
  it("allows the balance read needed after wallet connection", () => {
    expect(validateRpcRequest({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: ["0xabc", "latest"] })?.method)
      .toBe("eth_getBalance");
  });

  it("rejects signing and transaction submission methods", () => {
    expect(validateRpcRequest({ jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: ["0xdead"] })).toBeNull();
    expect(validateRpcRequest({ jsonrpc: "2.0", id: 2, method: "personal_sign", params: [] })).toBeNull();
  });

  it("rejects malformed and batched payloads", () => {
    expect(validateRpcRequest([{ jsonrpc: "2.0", id: 1, method: "eth_chainId" }])).toBeNull();
    expect(validateRpcRequest({ jsonrpc: "1.0", id: 1, method: "eth_chainId" })).toBeNull();
  });
});

