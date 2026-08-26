import { describe, expect, it } from "vitest";
import { describeWalletError, isImmediateOrCancelNoFillError, isUnrecognizedChainError, providerErrorCode } from "./provider-error.js";

describe("wallet provider errors", () => {
  it("extracts nested EIP-1193 error codes", () => {
    expect(providerErrorCode({ data: { originalError: { code: 4902 } } })).toBe(4902);
  });

  it("turns a plain-object rejection into an actionable message", () => {
    expect(describeWalletError({ code: 4001, message: "User rejected" }, "connect")).toContain("cancelled in the wallet");
  });

  it("surfaces an already-pending wallet prompt", () => {
    expect(describeWalletError({ code: -32002 }, "connect")).toContain("already waiting for approval");
  });

  it("recognizes wallets that report an unknown chain without code 4902", () => {
    expect(isUnrecognizedChainError({
      code: -32603,
      message: 'Unrecognized chain ID "0xc488". Try adding the chain first.',
    })).toBe(true);
  });

  it("recognizes nested and selector-only IOC no-fill reverts", () => {
    expect(isImmediateOrCancelNoFillError({ cause: { errorName: "ImmediateOrCancelNoFill" } })).toBe(true);
    expect(isImmediateOrCancelNoFillError({ data: "0xd48c4403" })).toBe(true);
    expect(isImmediateOrCancelNoFillError(new Error("placeBinaryOrder reverted: ImmediateOrCancelNoFill()"))).toBe(true);
  });
});
